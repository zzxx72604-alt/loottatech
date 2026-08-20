import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { OrderService } from '../../core/services/order.service';
import { UserService } from '../../core/services/user.service';
import { Order, OrderSummary } from '../../shared/models/order';

/**
 * Order history from two places at once.
 *
 * The route is behind authGuard, so there is always somebody signed in by the
 * time this runs. Their real history lives in SQL Server and arrives through
 * GET /orders/mine.
 *
 * The second source is guest checkouts made in this browser before they had
 * an account. Those orders have no UserId, so the server cannot return them —
 * only the browser knows the codes.
 *
 * Both are loaded and merged rather than one replacing the other. Somebody
 * who checks out as a guest and then creates an account would otherwise watch
 * their orders disappear the moment they signed in — the orders are still
 * there, they just are not attached to the new account.
 *
 * The two requests run together with forkJoin instead of one after the other,
 * so the page waits for the slower of the two rather than the sum of both.
 */
@Component({
  selector: 'app-my-orders',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrders {
  private readonly orderService = inject(OrderService);
  private readonly users = inject(UserService);

  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    forkJoin([this.fromAccount(), this.fromBrowser()]).subscribe({
      next: ([account, browser]) => {
        this.orders.set(merge(account, browser));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** A failure here must not blank out the rest of the page. */
  private fromAccount(): Observable<OrderSummary[]> {
    if (!this.users.isLoggedIn()) return of([]);

    return this.orderService.mine().pipe(catchError(() => of([] as OrderSummary[])));
  }

  /** Guest codes saved before this person had an account, looked up one by one. */
  private fromBrowser(): Observable<OrderSummary[]> {
    const numbers = this.orderService.myOrderNumbers();
    if (numbers.length === 0) return of([]);

    return forkJoin(
      numbers.map((number) =>
        this.orderService.byNumber(number).pipe(
          map(toSummary),
          // Skip anything the shop has since removed, rather than failing
          // the whole page because one code no longer resolves.
          catchError(() => of(null)),
        ),
      ),
    ).pipe(map((rows) => rows.filter((row): row is OrderSummary => row !== null)));
  }

  protected statusClass(status: string): string {
    return 's-' + status.toLowerCase().replace(/\s+/g, '-');
  }
}

function toSummary(order: Order): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    totalPrice: order.totalPrice,
    status: order.status,
    createdAt: order.createdAt,
  };
}

/**
 * One row per order, newest first.
 *
 * The account version wins on a clash: the same order can appear in both
 * lists if it was placed on this browser while signed in, and the account
 * copy is the one the server considers authoritative.
 */
function merge(account: OrderSummary[], browser: OrderSummary[]): OrderSummary[] {
  const byNumber = new Map<string, OrderSummary>();

  for (const order of browser) byNumber.set(order.orderNumber, order);
  for (const order of account) byNumber.set(order.orderNumber, order);

  return [...byNumber.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
