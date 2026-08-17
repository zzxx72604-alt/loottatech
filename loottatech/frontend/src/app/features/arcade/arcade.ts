import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArcadeService } from '../../core/services/arcade.service';
import { UserService } from '../../core/services/user.service';
import { ArcadeState, RewardState, Voucher } from '../../shared/models/arcade';
import { FlyerGame } from './flyer-game';
import { PrizeWheel } from './prize-wheel';

type Mode = 'flyer' | 'wheel';

@Component({
  selector: 'app-arcade',
  imports: [DatePipe, FormsModule, RouterLink, FlyerGame, PrizeWheel],
  templateUrl: './arcade.html',
  styleUrl: './arcade.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Arcade {
  private readonly arcade = inject(ArcadeService);
  protected readonly users = inject(UserService);

  @ViewChild(FlyerGame) private flyer?: FlyerGame;
  @ViewChild(PrizeWheel) private wheel?: PrizeWheel;

  protected readonly mode = signal<Mode>('flyer');
  protected readonly state = signal<ArcadeState | null>(null);
  protected readonly rewards = signal<RewardState | null>(null);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly spinning = signal(false);

  // ---- admin-issued top-up codes --------------------------------------
  protected codeInput = '';
  protected readonly codeBusy = signal(false);
  protected readonly codeMessage = signal('');
  protected readonly codeError = signal('');

  /** Free plays in hand, granted by an admin code. */
  protected readonly freePlays = computed(() => this.state()?.playsLeftToday ?? 0);

  /**
   * Playable if there's a free play, or enough coins to pay for one.
   * There is no daily cap — coins already limit how much anyone can play.
   */
  protected readonly canPlay = computed(() => {
    const s = this.state();
    if (!s) return false;
    return s.playsLeftToday > 0 || s.canAfford;
  });

  /** Progress towards the next tier, as a percentage. */
  protected readonly tierProgress = computed(() => {
    const s = this.state();
    if (!s || !s.nextTier) return 100;
    const target = s.lifetimeItems + s.itemsToNextTier;
    return target === 0 ? 0 : Math.round((s.lifetimeItems / target) * 100);
  });

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.arcade.state().subscribe({
      next: (s) => {
        this.state.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.loading.set(false);
      },
    });

    this.arcade.rewards().subscribe({
      next: (r) => this.rewards.set(r),
      error: () => {},
    });
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.message.set('');
  }

  /* ------------------------------------------------------------- wheel */

  protected spin(): void {
    if (this.busy() || this.spinning() || !this.canPlay()) return;

    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    this.arcade.spin().subscribe({
      next: (result) => {
        // The server already picked the wedge. The wheel only animates
        // towards a result that has already been decided and saved.
        this.spinning.set(true);

        this.wheel?.spinTo(result.prizeIndex, () => {
          this.spinning.set(false);
          this.message.set(result.message);
          this.busy.set(false);
          this.patchPlays(result.playsLeftToday, result.balance, result.streak);
          this.reloadRewards();
        });
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  /* ------------------------------------------------------------- flyer */

  /** The game asks; the API decides whether a play is available. */
  protected startFlyer(): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.message.set('');

    this.arcade.startRound().subscribe({
      next: (start) => {
        this.roundToken.set(start.token);
        this.patchPlays(start.playsLeftToday);
        this.flyer?.begin();
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  private readonly roundToken = signal('');

  protected onGameOver(score: number): void {
    const token = this.roundToken();
    if (!token) return;

    this.roundToken.set('');

    this.arcade.finishRound(token, score).subscribe({
      next: (result) => {
        this.message.set(
          result.newRecord ? `New personal best! ${result.message}` : result.message,
        );
        this.patchPlays(result.playsLeftToday, result.balance, result.streak, result.bestScore);
        this.reloadRewards();
      },
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  /* ---------------------------------------------------------- vouchers */

  protected redeem(key: string): void {
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    this.arcade.redeem(key).subscribe({
      next: (voucher: Voucher) => {
        this.message.set(`Voucher ${voucher.code} is yours — use it at checkout.`);
        this.busy.set(false);
        this.reloadRewards();
        this.arcade.state().subscribe((s) => this.state.set(s));
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  /* ------------------------------------------------------ top-up codes */

  protected useCode(): void {
    const code = this.codeInput.trim();
    if (!code || this.codeBusy()) return;

    this.codeBusy.set(true);
    this.codeMessage.set('');
    this.codeError.set('');

    this.arcade.useCode(code).subscribe({
      next: (result) => {
        this.codeMessage.set(result.message);
        this.codeInput = '';
        this.codeBusy.set(false);
        this.refresh();
      },
      error: (err) => {
        this.codeError.set(this.explain(err));
        this.codeBusy.set(false);
      },
    });
  }

  protected copy(code: string): void {
    navigator.clipboard?.writeText(code);
    this.message.set(`${code} copied.`);
  }

  /* ----------------------------------------------------------- helpers */

  private reloadRewards(): void {
    this.arcade.rewards().subscribe({ next: (r) => this.rewards.set(r) });
  }

  private patchPlays(playsLeft: number, balance?: number, streak?: number, best?: number): void {
    this.state.update((s) =>
      s
        ? {
            ...s,
            playsLeftToday: playsLeft,
            balance: balance ?? s.balance,
            streak: streak ?? s.streak,
            bestScore: best ?? s.bestScore,
          }
        : s,
    );
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown };
    if (e.status === 0) return "Can't reach the shop. Is the API running?";
    if (typeof e.error === 'string') return e.error;
    return 'Something went wrong.';
  }
}
