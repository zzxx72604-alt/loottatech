import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../../core/services/order.service';
import { Order, ORDER_STATUSES } from '../../shared/models/order';

@Component({
  selector: 'app-order-confirmation',
  imports: [CurrencyPipe, DatePipe, NgOptimizedImage, RouterLink],
  templateUrl: './order-confirmation.html',
  styleUrl: './order-confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderConfirmation {
  private readonly orders = inject(OrderService);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);

  // ---- asking for a refund ----
  protected readonly asking = signal(false);
  protected readonly reason = signal('');
  protected readonly sending = signal(false);
  protected readonly refundError = signal('');

  /** Captured here, in an injection context, so the @Input setter below can
      use takeUntilDestroyed() safely. */
  private readonly destroyRef = inject(DestroyRef);

  /** The progress bar stops at Delivered; Cancelled is handled separately. */
  protected readonly steps = ORDER_STATUSES.filter((s) => s !== 'Cancelled');

  @Input() set orderNumber(value: string) {
    this.loading.set(true);
    this.orders
      .byNumber(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected stepIndex(order: Order): number {
    return this.steps.indexOf(order.status as (typeof this.steps)[number]);
  }

  protected cancelRefund(): void {
    this.asking.set(false);
    this.refundError.set('');
    this.reason.set('');
  }

  /**
   * Sends the request and swaps in the order the API sends back, so the page
   * shows the recorded state rather than what this browser assumed happened.
   */
  protected sendRefund(order: Order): void {
    const reason = this.reason().trim();

    if (reason.length < 5) {
      this.refundError.set('A sentence is enough — what went wrong?');
      return;
    }

    this.sending.set(true);
    this.refundError.set('');

    this.orders.requestRefund(order.id, reason).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.asking.set(false);
        this.reason.set('');
        this.sending.set(false);
      },
      error: (err: { error?: unknown }) => {
        this.refundError.set(
          typeof err.error === 'string' ? err.error : 'Could not send that. Try again.',
        );
        this.sending.set(false);
      },
    });
  }
}
