import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Order, OrderStatus, OrderSummary } from '../../shared/models/order';

@Injectable({ providedIn: 'root' })
export class OrderApi {
  private readonly api = inject(ApiService);

  list(status = ''): Observable<OrderSummary[]> {
    return this.api.get<OrderSummary[]>('orders', { status });
  }

  get(id: number): Observable<Order> {
    return this.api.get<Order>(`orders/${id}`);
  }

  setStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.api.put<Order>(`orders/${id}/status`, { status });
  }

  /**
   * Answer a refund request.
   *
   * Approving unwinds the order on the server — stock back on the shelf,
   * coins back out of the customer's balance — so nothing here has to.
   */
  decideRefund(id: number, approve: boolean): Observable<Order> {
    return this.api.put<Order>(`orders/${id}/refund`, { approve });
  }
}
