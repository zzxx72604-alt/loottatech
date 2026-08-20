import { Injectable } from '@angular/core';

/** Order codes this browser placed without an account. */
const HISTORY_KEY = 'lootta-order-numbers';

/**
 * The order codes belonging to a guest checkout.
 *
 * This is deliberately its own service rather than a few methods on
 * OrderService. OrderService needs to know whether anyone is signed in, and
 * UserService needs to clear this list on sign out — putting the storage in
 * either one would make the two services depend on each other in a circle,
 * which Angular cannot construct. A small store that depends on nothing
 * breaks the cycle.
 *
 * Only guest orders belong here. An order placed while signed in belongs to
 * the account and comes back from GET /orders/mine, so writing it here as
 * well would leave it visible in this browser after sign out — which is the
 * one thing signing out is supposed to prevent.
 */
@Injectable({ providedIn: 'root' })
export class GuestOrderStore {
  all(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
      return Array.isArray(raw) ? (raw as string[]) : [];
    } catch {
      // Corrupt or tampered-with storage should not break the page.
      return [];
    }
  }

  add(orderNumber: string): void {
    const list = this.all();
    if (list.includes(orderNumber)) return;

    localStorage.setItem(HISTORY_KEY, JSON.stringify([orderNumber, ...list].slice(0, 30)));
  }

  /** Called on sign out, so the next person at this computer sees nothing. */
  clear(): void {
    localStorage.removeItem(HISTORY_KEY);
  }
}
