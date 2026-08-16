import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../../core/services/order.service';
import { UserService } from '../../core/services/user.service';
import { Order } from '../../shared/models/order';

@Component({
  selector: 'app-my-orders',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrders {
  private readonly orderService = inject(OrderService);
  protected readonly users = inject(UserService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.orderService
      .mine()
      .pipe(takeUntilDestroyed())
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
