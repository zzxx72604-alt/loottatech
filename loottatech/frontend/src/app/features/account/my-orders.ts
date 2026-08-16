import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { OrderService } from '../../core/services/order.service';
import { Order } from '../../shared/models/order';

/**
 * Order history without a login.
 *
 * The API has no authentication yet, so there is no server-side "my orders".
 * Instead the browser remembers the order numbers it created at checkout and
 * looks each one up. A different browser sees a different history — which is
 * exactly what a guest checkout can honestly offer.
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

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    const numbers = this.orderService.myOrderNumbers();

    if (numbers.length === 0) {
      this.loading.set(false);
      return;
    }

    // Look them all up at once; skip any the shop has since removed.
    forkJoin(
      numbers.map((n) => this.orderService.byNumber(n).pipe(catchError(() => of(null)))),
    )
      .pipe(map((results) => results.filter((o): o is Order => o !== null)))
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected statusClass(status: string): string {
    return 's-' + status.toLowerCase().replace(/\s+/g, '-');
  }
}
