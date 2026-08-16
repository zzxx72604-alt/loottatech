import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

interface Wedge {
  prize: number;
  /** Slice boundaries in degrees, measured clockwise from the top. */
  start: number;
  end: number;
  mid: number;
  /** SVG arc path for the slice. */
  path: string;
  labelX: number;
  labelY: number;
  /** Percentage chance, for the odds list under the wheel. */
  chance: number;
  fill: string;
}

const CENTRE = 100;
const RADIUS = 94;
const LABEL_RADIUS = 66;

/**
 * The prize wheel, drawn as SVG so each slice can be sized by its real odds.
 *
 * A wheel with eight equal slices and wildly unequal probabilities looks fair
 * and isn't. Here the 4x jackpot gets a thin sliver because it is rare, and the
 * common small prizes get wide ones — the picture matches the maths.
 *
 * Dumb component: it is told the prizes, the weights and which index won.
 * It knows nothing about coins, the API, or the player.
 */
@Component({
  selector: 'app-prize-wheel',
  templateUrl: './prize-wheel.html',
  styleUrl: './prize-wheel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrizeWheel {
  private readonly prizes = signal<number[]>([]);
  private readonly weights = signal<number[]>([]);

  @Input({ required: true }) set wheel(value: number[]) {
    this.prizes.set(value ?? []);
  }

  @Input() set wheelWeights(value: number[]) {
    this.weights.set(value ?? []);
  }

  /** Total rotation applied to the wheel, in degrees. */
  protected readonly angle = signal(0);
  protected readonly spinning = signal(false);

  protected readonly wedges = computed<Wedge[]>(() => {
    const prizes = this.prizes();
    if (prizes.length === 0) return [];

    // Fall back to equal odds if the API didn't send weights.
    const weights =
      this.weights().length === prizes.length ? this.weights() : prizes.map(() => 1);

    const total = weights.reduce((sum, w) => sum + w, 0) || 1;

    let cursor = 0;
    return prizes.map((prize, i) => {
      const sweep = (weights[i] / total) * 360;
      const start = cursor;
      const end = cursor + sweep;
      const mid = start + sweep / 2;
      cursor = end;

      const labelPoint = this.pointAt(mid, LABEL_RADIUS);

      return {
        prize,
        start,
        end,
        mid,
        path: this.arcPath(start, end),
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        chance: Math.round((weights[i] / total) * 1000) / 10,
        // Alternating shades, with the last slice forced to differ from the
        // first so they never touch as the same colour.
        fill: i % 2 === 0 ? 'var(--wheel-a)' : 'var(--wheel-b)',
      };
    });
  });

  /**
   * Spins to the winning wedge. The SERVER chose the index — this only plays
   * the animation towards a result that is already decided.
   */
  spinTo(index: number, onDone: () => void): void {
    const wedge = this.wedges()[index];
    if (!wedge) {
      onDone();
      return;
    }

    // Land the wedge's middle under the pointer at the top, after five turns.
    const current = this.angle();
    const currentTurns = Math.floor(current / 360);
    const target = (currentTurns + 5) * 360 + (360 - wedge.mid);

    this.spinning.set(true);
    this.angle.set(target);

    setTimeout(() => {
      this.spinning.set(false);
      onDone();
    }, 3400);
  }

  /* --------------------------------------------------------- geometry */

  /** Degrees clockwise from the top, converted to an SVG coordinate. */
  private pointAt(degrees: number, radius: number): { x: number; y: number } {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return {
      x: CENTRE + radius * Math.cos(radians),
      y: CENTRE + radius * Math.sin(radians),
    };
  }

  private arcPath(start: number, end: number): string {
    const from = this.pointAt(start, RADIUS);
    const to = this.pointAt(end, RADIUS);
    const largeArc = end - start > 180 ? 1 : 0;

    return [
      `M ${CENTRE} ${CENTRE}`,
      `L ${from.x.toFixed(2)} ${from.y.toFixed(2)}`,
      `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  }
}
