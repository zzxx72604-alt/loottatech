import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../../core/services/order.service';
import { Order, ORDER_STATUSES } from '../../shared/models/order';

@Component({
  selector: 'app-order-confirmation',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './order-confirmation.html',
  styleUrl: './order-confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderConfirmation {
  private readonly orders = inject(OrderService);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);

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
}
