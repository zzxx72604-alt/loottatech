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

  /**
   * The returned item is back on the counter: pay the customer.
   *
   * A person confirms this rather than a courier status, because the shop is
   * signing off on what actually turned up in the box.
   */
  confirmReturned(id: number): Observable<Order> {
    return this.api.put<Order>(`orders/${id}/refund/received`, {});
  }
}
