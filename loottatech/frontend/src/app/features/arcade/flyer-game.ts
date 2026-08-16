import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

type Phase = 'ready' | 'playing' | 'dead';

interface Gap {
  x: number;
  /** Vertical centre of the opening. */
  y: number;
  passed: boolean;
}

/**
 * Lootta Flyer — tap to fly, dodge the shelves.
 *
 * A dumb presentational component: it plays the game and emits the score.
 * It knows nothing about coins, the API or the player — the parent decides
 * what a score is worth. Same principle as ProductCard.
 *
 * Drawn on a canvas with requestAnimationFrame, and stepped with a fixed
 * timestep so the difficulty is identical on a 60Hz and a 144Hz screen.
 */
@Component({
  selector: 'app-flyer-game',
  templateUrl: './flyer-game.html',
  styleUrl: './flyer-game.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlyerGame implements AfterViewInit, OnDestroy {
  @ViewChild('board') private boardRef!: ElementRef<HTMLCanvasElement>;

  /** Fired once per round, when the bird crashes. */
  @Output() gameOver = new EventEmitter<number>();

  /** Fired when the player asks to start — the parent must call `begin()`. */
  @Output() wantsToStart = new EventEmitter<void>();

  protected readonly phase = signal<Phase>('ready');
  protected readonly score = signal(0);

  // ---- world constants, in canvas units -------------------------------
  private readonly W = 360;
  private readonly H = 480;
  private readonly GRAVITY = 0.45;
  private readonly FLAP = -7.4;
  private readonly SPEED = 2.1;
  private readonly GAP_HEIGHT = 132;
  private readonly GAP_SPACING = 190;
  private readonly BIRD_X = 92;
  private readonly BIRD_R = 13;

  private ctx!: CanvasRenderingContext2D;
  private frame = 0;
  private accumulator = 0;
  private lastTime = 0;

  private birdY = 0;
  private birdV = 0;
  private gaps: Gap[] = [];

  ngAfterViewInit(): void {
    const canvas = this.boardRef.nativeElement;
    canvas.width = this.W;
    canvas.height = this.H;
    this.ctx = canvas.getContext('2d')!;

    this.reset();
    this.loop(performance.now());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  /** Called by the parent once the API has granted a play. */
  begin(): void {
    this.reset();
    this.phase.set('playing');
  }

  protected onTap(event?: Event): void {
    event?.preventDefault();

    if (this.phase() === 'playing') {
      this.birdV = this.FLAP;
      return;
    }

    // "ready" and "dead" both mean: ask the parent for another play.
    this.wantsToStart.emit();
  }

  /* ------------------------------------------------------------- engine */

  private reset(): void {
    this.birdY = this.H / 2;
    this.birdV = 0;
    this.score.set(0);
    this.gaps = [0, 1, 2].map((i) => ({
      x: this.W + i * this.GAP_SPACING,
      y: this.randomGapY(),
      passed: false,
    }));
  }

  private randomGapY(): number {
    const margin = this.GAP_HEIGHT / 2 + 40;
    return margin + Math.random() * (this.H - margin * 2);
  }

  private loop = (now: number): void => {
    this.frame = requestAnimationFrame(this.loop);

    // Fixed timestep: the physics always advances in 1/60s slices, so a
    // fast monitor does not make the game harder.
    const STEP = 1000 / 60;
    this.accumulator += Math.min(now - this.lastTime, 100);
    this.lastTime = now;

    while (this.accumulator >= STEP) {
      this.step();
      this.accumulator -= STEP;
    }

    this.draw();
  };

  private step(): void {
    if (this.phase() !== 'playing') return;

    this.birdV += this.GRAVITY;
    this.birdY += this.birdV;

    for (const gap of this.gaps) {
      gap.x -= this.SPEED;

      if (!gap.passed && gap.x + 26 < this.BIRD_X - this.BIRD_R) {
        gap.passed = true;
        this.score.update((s) => s + 1);
      }

      // Recycle a shelf once it leaves the screen.
      if (gap.x < -60) {
        gap.x += this.GAP_SPACING * this.gaps.length;
        gap.y = this.randomGapY();
        gap.passed = false;
      }
    }

    if (this.hasCrashed()) {
      this.phase.set('dead');
      this.gameOver.emit(this.score());
    }
  }

  private hasCrashed(): boolean {
    if (this.birdY + this.BIRD_R > this.H || this.birdY - this.BIRD_R < 0) return true;

    for (const gap of this.gaps) {
      const withinColumn =
        this.BIRD_X + this.BIRD_R > gap.x && this.BIRD_X - this.BIRD_R < gap.x + 52;

      if (!withinColumn) continue;

      const clearsTop = this.birdY - this.BIRD_R > gap.y - this.GAP_HEIGHT / 2;
      const clearsBottom = this.birdY + this.BIRD_R < gap.y + this.GAP_HEIGHT / 2;

      if (!clearsTop || !clearsBottom) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ drawing */

  private draw(): void {
    const c = this.ctx;

    const sky = c.createLinearGradient(0, 0, 0, this.H);
    sky.addColorStop(0, '#1d1d20');
    sky.addColorStop(1, '#2b2b31');
    c.fillStyle = sky;
    c.fillRect(0, 0, this.W, this.H);

    // shelves
    for (const gap of this.gaps) {
      c.fillStyle = '#ffe411';
      const topH = gap.y - this.GAP_HEIGHT / 2;
      const bottomY = gap.y + this.GAP_HEIGHT / 2;

      c.fillRect(gap.x, 0, 52, topH);
      c.fillRect(gap.x, bottomY, 52, this.H - bottomY);

      c.fillStyle = '#e5cd0f';
      c.fillRect(gap.x - 4, topH - 14, 60, 14);
      c.fillRect(gap.x - 4, bottomY, 60, 14);
    }

    // bird — rotates with velocity so it feels alive
    c.save();
    c.translate(this.BIRD_X, this.birdY);
    c.rotate(Math.max(-0.5, Math.min(0.9, this.birdV / 12)));

    c.fillStyle = '#ff4e00';
    c.beginPath();
    c.arc(0, 0, this.BIRD_R, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(5, -4, 4, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#1d1d20';
    c.beginPath();
    c.arc(6.5, -4, 2, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // score
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.font = 'bold 34px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(String(this.score()), this.W / 2, 56);
  }
}
