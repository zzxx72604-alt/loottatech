import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { CreateOrderRequest, Order } from '../../shared/models/order';

/** Order numbers this browser has placed, so "My orders" works without login. */
const HISTORY_KEY = 'lootta-order-numbers';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);

  create(order: CreateOrderRequest): Observable<Order> {
    return this.api
      .post<Order>('orders', order)
      .pipe(tap((created) => this.remember(created.orderNumber)));
  }

  byNumber(orderNumber: string): Observable<Order> {
    return this.api.get<Order>(`orders/number/${orderNumber}`);
  }

  byId(id: number | string): Observable<Order> {
    return this.api.get<Order>(`orders/${id}`);
  }

  /**
   * The API has no login yet, so there is no server-side "my orders".
   * Instead we remember the order numbers this browser created and look
   * each one up. Honest, and it works for a guest checkout.
   */
  myOrderNumbers(): string[] {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  }

  private remember(orderNumber: string): void {
    const list = this.myOrderNumbers();
    if (!list.includes(orderNumber)) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify([orderNumber, ...list].slice(0, 30)));
    }
  }
}
