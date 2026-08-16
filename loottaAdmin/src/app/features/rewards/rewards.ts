import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RewardApi } from '../../core/services/reward-api.service';
import { EconomyConfig, RedeemCode, Voucher } from '../../shared/models/reward';

type Tab = 'codes' | 'vouchers' | 'grant' | 'economy';

@Component({
  selector: 'app-rewards',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './rewards.html',
  styleUrl: './rewards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rewards {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RewardApi);

  protected readonly tab = signal<Tab>('codes');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly codes = signal<RedeemCode[]>([]);
  protected readonly vouchers = signal<Voucher[]>([]);
  protected readonly config = signal<EconomyConfig | null>(null);

  /** Arcade code — gives coins and/or plays, redeemed on the game page. */
  protected readonly codeForm = this.fb.nonNullable.group({
    coins: [500, [Validators.required, Validators.min(0)]],
    plays: [10, [Validators.required, Validators.min(0)]],
    maxUses: [1, [Validators.required, Validators.min(0)]],
    label: ['Testing'],
    expiryDays: [30, [Validators.required, Validators.min(1)]],
    code: [''],
  });

  /** Discount voucher — money off an order, redeemed at checkout. */
  protected readonly voucherForm = this.fb.nonNullable.group({
    value: [5, [Validators.required, Validators.min(0.5)]],
    minSpend: [20, [Validators.required, Validators.min(0)]],
    expiryDays: [30, [Validators.required, Validators.min(1)]],
    count: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
    userId: [''],
  });

  /** Straight top-up of one account. */
  protected readonly grantForm = this.fb.nonNullable.group({
    userId: [2, [Validators.required, Validators.min(1)]],
    coins: [5000, [Validators.min(0)]],
    plays: [999, [Validators.min(0)]],
    reason: ['Testing'],
  });

  protected readonly configForm = this.fb.nonNullable.group({
    coinsPerDollar: [40, [Validators.required, Validators.min(0)]],
    playCost: [50, [Validators.required, Validators.min(0)]],
    flyerCoinsPerPoint: [8, [Validators.required, Validators.min(0)]],
    flyerMaxPerRound: [400, [Validators.required, Validators.min(0)]],
    coinsPerVoucherDollar: [300, [Validators.required, Validators.min(1)]],
    voucherMinSpendMultiplier: [10, [Validators.required, Validators.min(1)]],
    voucherExpiryDays: [30, [Validators.required, Validators.min(1)]],
    browserPlays: [5, [Validators.required, Validators.min(0)]],
    bronzeItems: [1, [Validators.required, Validators.min(0)]],
    bronzePlays: [1, [Validators.required, Validators.min(0)]],
    silverItems: [5, [Validators.required, Validators.min(0)]],
    silverPlays: [2, [Validators.required, Validators.min(0)]],
    goldItems: [20, [Validators.required, Validators.min(0)]],
    goldPlays: [4, [Validators.required, Validators.min(0)]],
    welcomeCoins: [100, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.loadCodes();
    this.loadVouchers();
    this.loadConfig();
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.message.set('');
    this.error.set('');
  }

  /* -------------------------------------------------------- arcade codes */

  protected loadCodes(): void {
    this.api.codes().subscribe({
      next: (codes) => this.codes.set(codes),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected createCode(): void {
    if (this.codeForm.invalid || this.busy()) return;

    const raw = this.codeForm.getRawValue();
    if (raw.coins === 0 && raw.plays === 0) {
      this.error.set('A code must give coins, plays, or both.');
      return;
    }

    this.busy.set(true);
    this.error.set('');

    this.api.createCode({ ...raw, code: raw.code.trim() || null }).subscribe({
      next: (code) => {
        this.message.set(`Created ${code.code}`);
        this.codeForm.controls.code.setValue('');
        this.busy.set(false);
        this.loadCodes();
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  protected toggleCode(code: RedeemCode): void {
    const next = !code.isActive;

    this.api.setCodeActive(code.id, next).subscribe({
      next: () =>
        this.codes.update((list) =>
          list.map((c) => (c.id === code.id ? { ...c, isActive: next, usable: next && c.usable } : c)),
        ),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  /* ----------------------------------------------------------- vouchers */

  protected loadVouchers(): void {
    this.api.vouchers().subscribe({
      next: (list) => this.vouchers.set(list),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected createVouchers(): void {
    if (this.voucherForm.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    const raw = this.voucherForm.getRawValue();
    const userId = raw.userId.trim() ? Number(raw.userId) : null;

    this.api.generateVouchers({ ...raw, userId }).subscribe({
      next: (created) => {
        this.message.set(
          created.length === 1
            ? `Created ${created[0].code}`
            : `Created ${created.length} vouchers`,
        );
        this.busy.set(false);
        this.loadVouchers();
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  /* -------------------------------------------------------------- grant */

  protected grant(): void {
    if (this.grantForm.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    this.api.grant(this.grantForm.getRawValue()).subscribe({
      next: (result) => {
        this.message.set(result.message);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  /* ------------------------------------------------------------ economy */

  protected loadConfig(): void {
    this.api.config().subscribe({
      next: (config) => {
        this.config.set(config);
        this.configForm.patchValue(config);
      },
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected saveConfig(): void {
    if (this.configForm.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    const current = this.config();
    const body = { ...(current ?? {}), ...this.configForm.getRawValue() } as EconomyConfig;

    this.api.saveConfig(body).subscribe({
      next: (saved) => {
        this.config.set(saved);
        this.message.set('Economy updated — live for everyone immediately.');
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.busy.set(false);
      },
    });
  }

  /* ----------------------------------------------------------- helpers */

  protected copy(text: string): void {
    navigator.clipboard?.writeText(text);
    this.message.set(`${text} copied.`);
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown };

    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (e.status === 401) return 'Not signed in, or the token expired. Sign in again.';
    if (e.status === 403) return 'This account is not allowed to do that.';
    if (typeof e.error === 'string' && e.error) return e.error;

    return `Request failed with status ${e.status ?? 'unknown'}.`;
  }
}
