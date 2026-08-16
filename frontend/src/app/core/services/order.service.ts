import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CreateOrderRequest, Order, OrderStatus } from '../../shared/models/order';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);

  create(order: CreateOrderRequest): Observable<Order> {
    return this.api.post<Order>('orders', order);
  }

  /** Orders belonging to the signed-in customer. */
  mine(): Observable<Order[]> {
    return this.api.get<Order[]>('orders/mine');
  }

  byId(id: string): Observable<Order> {
    return this.api.get<Order>(`orders/${id}`);
  }

  /** Guests track an order using the code printed on their receipt. */
  byNumber(orderNumber: string): Observable<Order> {
    return this.api.get<Order>(`orders/number/${orderNumber}`);
  }

  all(): Observable<Order[]> {
    return this.api.get<Order[]>('orders/all');
  }

  setStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.api.put<Order>(`orders/${id}/status`, { status });
  }
}
