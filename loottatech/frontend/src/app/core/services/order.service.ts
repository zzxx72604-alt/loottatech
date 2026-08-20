import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { GuestOrderStore } from './guest-orders.service';
import { UserService } from './user.service';
import {
  CreateOrderRequest,
  Order,
  OrderPreview,
  OrderSummary,
  PaymentOption,
} from '../../shared/models/order';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);
  private readonly guests = inject(GuestOrderStore);
  private readonly users = inject(UserService);

  create(order: CreateOrderRequest): Observable<Order> {
    return this.api.post<Order>('orders', order).pipe(
      tap((created) => {
        /*
         * Only a guest order is written to this browser.
         *
         * A signed-in customer's order is already attached to their account
         * and comes back from mine(). Saving it here too would leave it on
         * display after they signed out, on a shared computer, to whoever
         * sat down next.
         */
        if (!this.users.isLoggedIn()) this.guests.add(created.orderNumber);
      }),
    );
  }

  /**
   * Ask the server what this order would cost, without placing it.
   *
   * The discount is worked out by the API from the voucher row, exactly as it
   * will be at checkout — the browser only displays the answer.
   */
  preview(order: CreateOrderRequest): Observable<OrderPreview> {
    return this.api.post<OrderPreview>('orders/preview', order);
  }

  /** What the shop accepts. Comes from the API, never hardcoded here. */
  paymentMethods(): Observable<PaymentOption[]> {
    return this.api.get<PaymentOption[]>('orders/payment-methods');
  }

  byNumber(orderNumber: string): Observable<Order> {
    return this.api.get<Order>(`orders/number/${orderNumber}`);
  }

  byId(id: number | string): Observable<Order> {
    return this.api.get<Order>(`orders/${id}`);
  }

  /** The signed-in customer's real history, straight from SQL Server. */
  mine(): Observable<OrderSummary[]> {
    return this.api.get<OrderSummary[]>('orders/mine');
  }

  /**
   * Codes from guest checkouts in this browser.
   *
   * Guest checkout has no account for an order to belong to, so the codes are
   * kept locally and looked up one by one. A signed-in customer gets mine()
   * instead, and the two lists are merged so creating an account after
   * checking out as a guest loses nothing.
   */
  myOrderNumbers(): string[] {
    return this.guests.all();
  }
}
