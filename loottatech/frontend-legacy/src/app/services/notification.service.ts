import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription, switchMap, timer } from 'rxjs';
import { ORDERS_URL } from '../shared/constants/urls';
import { Order } from '../shared/models/Order';
import { User } from '../shared/models/User';
import { UserService } from './user.service';

export interface NotifItem {
  id: string;
  text: string;
  link: string;
}

const SEEN_KEY = 'lootta_seen_notifs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private countSubject = new BehaviorSubject<number>(0);
  count$ = this.countSubject.asObservable();
  private itemsSubject = new BehaviorSubject<NotifItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  private poll?: Subscription;
  private isAdmin = false;

  constructor(private http: HttpClient, private userService: UserService) {
    this.userService.userObservable.subscribe((user) => {
      this.stop();
      if (user && user.token) this.start(user);
    });
  }

  private start(user: User) {
    this.isAdmin = !!user.isAdmin;
    const url = this.isAdmin ? ORDERS_URL + '/all' : ORDERS_URL;
    const options = { headers: new HttpHeaders({ 'skip-loading': 'true' }) };

    // poll immediately, then every 20s — silent (no global spinner)
    this.poll = timer(0, 20000)
      .pipe(switchMap(() => this.http.get<Order[]>(url, options)))
      .subscribe({
        next: (orders) => this.compute(orders || []),
        error: () => {},
      });
  }

  private stop() {
    this.poll?.unsubscribe();
    this.poll = undefined;
    this.countSubject.next(0);
    this.itemsSubject.next([]);
  }

  private compute(orders: Order[]) {
    if (this.isAdmin) {
      // pending requests = paid orders not yet delivered
      const pending = orders.filter((o) => o.status === 'PAYED');
      this.itemsSubject.next(
        pending.map((o) => ({
          id: o.id.toString(),
          text: `New order from ${o.name}`,
          link: '/manage-orders',
        }))
      );
      this.countSubject.next(pending.length);
    } else {
      // customer: orders that were delivered/completed
      const delivered = orders.filter((o) => o.status === 'DELIVERED');
      const seen = this.getSeen();
      const unseen = delivered.filter((o) => !seen.includes(o.id.toString()));
      this.itemsSubject.next(
        delivered.map((o) => ({
          id: o.id.toString(),
          text: 'Your order has been delivered 🎉',
          link: '/orders',
        }))
      );
      this.countSubject.next(unseen.length);
    }
  }

  /** Called when the user opens the bell — clears the customer badge. */
  markSeen() {
    if (this.isAdmin) return; // admin badge reflects live pending count
    const seen = this.getSeen();
    this.itemsSubject.value.forEach((i) => {
      if (!seen.includes(i.id)) seen.push(i.id);
    });
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    this.countSubject.next(0);
  }

  private getSeen(): string[] {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    } catch {
      return [];
    }
  }
}
