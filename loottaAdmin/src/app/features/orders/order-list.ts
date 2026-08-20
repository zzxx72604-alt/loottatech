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

  /** Refund requests waiting on a person. */
  protected readonly refundsWaiting = computed(
    () => this.orders().filter((o) => o.refund === 'Requested').length,
  );

  /** Returns the shop is waiting to receive. */
  protected readonly returnsExpected = computed(
    () => this.orders().filter((o) => o.refund === 'ReturnPending' || o.refund === 'ReturnArranged')
      .length,
  );

  /** Wording for the badge, since the state names are not sentences. */
  protected refundLabel(state: string): string {
    switch (state) {
      case 'Requested': return 'Refund asked';
      case 'Declined': return 'Refund declined';
      case 'ReturnPending': return 'Waiting on return';
      case 'ReturnArranged': return 'Return on its way';
      case 'Refunded': return 'Refunded';
      default: return '';
    }
  }

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

  /**
   * Approve or decline a refund the customer asked for.
   *
   * Approving cancels the order and puts the stock back, so it asks first —
   * the same courtesy the status dropdown gives before cancelling.
   */
  protected decideRefund(order: OrderSummary, approve: boolean): void {
    const question = !approve
      ? `Decline the refund on ${order.orderNumber}?`
      : order.status === 'Completed'
        ? `Approve the refund on ${order.orderNumber}? The customer sends the item back first, and you pay once it arrives.`
        : `Refund ${order.orderNumber}? It hasn't been delivered, so the order is cancelled and the items go back into stock.`;

    if (!confirm(question)) return;

    this.api.decideRefund(order.id, approve).subscribe({
      next: (updated) =>
        this.patch(order.id, { refund: updated.refund, status: updated.status }),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  /** The item came back: unwind the order and pay the customer. */
  protected confirmReturned(order: OrderSummary): void {
    if (!confirm(`Has ${order.orderNumber} arrived back? This refunds the customer and returns the items to stock.`)) {
      return;
    }

    this.api.confirmReturned(order.id).subscribe({
      next: (updated) =>
        this.patch(order.id, { refund: updated.refund, status: updated.status }),
      error: (err) => this.error.set(this.explain(err)),
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
    const e = err as { status?: number; error?: unknown; message?: string };

    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (e.status === 401) return 'Not signed in, or the token expired. Sign in again.';
    if (e.status === 403) return 'This account is not allowed to do that.';
    if (typeof e.error === 'string' && e.error) return e.error;

    const problem = e.error as { title?: string; detail?: string } | undefined;
    if (problem?.detail) return `${e.status}: ${problem.detail}`;
    if (problem?.title) return `${e.status}: ${problem.title}`;

    return `Request failed with status ${e.status ?? 'unknown'}. Check the API terminal.`;
  }
}
