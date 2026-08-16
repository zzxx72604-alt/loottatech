import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';
import { catchError, of } from 'rxjs';
import { OrderApi } from './order-api.service';
import { OrderSummary } from '../../shared/models/order';

const POLL_MS = 10_000;

/**
 * Keeps the admin's view of orders fresh without anyone pressing refresh.
 *
 * Every 10 seconds it re-fetches the order list and compares the ids with what
 * it already had. Anything new triggers a notification.
 *
 * Deliberately polling rather than SignalR: polling is ordinary HTTPS, so it
 * works through Nginx and Cloudflare with no WebSocket configuration. One less
 * thing to break in production.
 *
 * One poll feeds everything — the badge, the toast, and the orders table all
 * read these signals, so there is only ever one request in flight.
 */
@Injectable({ providedIn: 'root' })
export class OrderNotifier {
  private readonly api = inject(OrderApi);

  /** Every order, refreshed automatically. */
  readonly orders = signal<OrderSummary[]>([]);
  readonly connected = signal(true);

  /** Orders that arrived since the admin last looked at the Orders page. */
  readonly unseen = signal<OrderSummary[]>([]);
  readonly unseenCount = computed(() => this.unseen().length);

  readonly pendingCount = computed(
    () => this.orders().filter((o) => o.status === 'Pending').length,
  );

  /** True until the first response arrives, so we don't announce every order at startup. */
  private firstLoad = true;
  private knownIds = new Set<number>();

  constructor() {
    interval(POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.api.list().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((orders) => {
        if (orders === null) {
          this.connected.set(false);
          return;
        }

        this.connected.set(true);

        if (this.firstLoad) {
          // Remember what already existed; only announce what comes next.
          this.knownIds = new Set(orders.map((o) => o.id));
          this.firstLoad = false;
        } else {
          const arrived = orders.filter((o) => !this.knownIds.has(o.id));
          if (arrived.length > 0) {
            this.unseen.update((list) => [...arrived, ...list]);
            for (const order of arrived) this.knownIds.add(order.id);
          }
        }

        this.orders.set(orders);
      });
  }

  /** Called when the admin opens the Orders page. */
  markSeen(): void {
    this.unseen.set([]);
  }

  dismiss(id: number): void {
    this.unseen.update((list) => list.filter((o) => o.id !== id));
  }

  /** Optimistic local update so the table reacts before the next poll. */
  patch(id: number, changes: Partial<OrderSummary>): void {
    this.orders.update((list) => list.map((o) => (o.id === id ? { ...o, ...changes } : o)));
  }

  /** Force an immediate refresh, e.g. after the admin changes a status. */
  refreshNow(): void {
    this.api.list().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.connected.set(true);
      },
      error: () => this.connected.set(false),
    });
  }
}
