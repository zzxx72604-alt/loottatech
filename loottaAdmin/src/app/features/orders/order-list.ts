import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderApi } from '../../core/services/order-api.service';
import { OrderNotifier } from '../../core/services/order-notifier.service';
import {
  ORDER_STATUSES,
  Order,
  OrderStatus,
  OrderSummary,
  nextStatus,
} from '../../shared/models/order';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-order-list',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderList {
  private readonly api = inject(OrderApi);
  private readonly notifier = inject(OrderNotifier);

  protected readonly statuses = ORDER_STATUSES;
  protected readonly fileBase = environment.fileBase;

  /** Comes from the poller, so the table refreshes itself every 10 seconds. */
  protected readonly orders = this.notifier.orders;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filter = signal<OrderStatus | ''>('');

  /** Which row is expanded, and the detail we loaded for it. */
  protected readonly openId = signal<number | null>(null);
  protected readonly detail = signal<Order | null>(null);
  protected readonly detailLoading = signal(false);

  protected readonly visible = computed(() => {
    const status = this.filter();
    return status ? this.orders().filter((o) => o.status === status) : this.orders();
  });

  protected readonly needsAction = computed(
    () => this.orders().filter((o) => o.status === 'Pending').length,
  );

  protected readonly revenue = computed(() =>
    this.orders()
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalPrice, 0),
  );

  constructor() {
    // Opening this page clears the "new order" toasts.
    this.notifier.markSeen();
    this.notifier.refreshNow();
    this.loading.set(false);
  }

  protected load(): void {
    this.error.set('');
    this.notifier.refreshNow();
  }

  protected toggle(order: OrderSummary): void {
    if (this.openId() === order.id) {
      this.openId.set(null);
      this.detail.set(null);
      return;
    }

    this.openId.set(order.id);
    this.detail.set(null);
    this.detailLoading.set(true);

    this.api.get(order.id).subscribe({
      next: (full) => {
        this.detail.set(full);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.detailLoading.set(false);
      },
    });
  }

  protected changeStatus(order: OrderSummary, status: OrderStatus): void {
    if (status === order.status) return;

    if (status === 'Cancelled' &&
        !confirm(`Cancel ${order.orderNumber}? The items go back into stock.`)) {
      return;
    }

    const previous = order.status;
    this.patch(order.id, { status });          // show it straight away

    this.api.setStatus(order.id, status).subscribe({
      error: (err) => {
        this.patch(order.id, { status: previous });   // put it back if rejected
        this.error.set(this.explain(err));
      },
    });
  }

  /** One-click "move it along" button. */
  protected advance(order: OrderSummary): void {
    const next = nextStatus(order.status);
    if (next) this.changeStatus(order, next);
  }

  protected next = nextStatus;

  protected statusClass(status: string): string {
    return 's-' + status.toLowerCase();
  }

  protected image(url: string): string {
    return url ? `${this.fileBase}${url}-480.webp` : '';
  }

  private patch(id: number, changes: Partial<OrderSummary>): void {
    this.notifier.patch(id, changes);
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown };
    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (typeof e.error === 'string') return e.error;
    return 'Something went wrong talking to the API.';
  }
}
