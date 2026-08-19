import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { interval, startWith, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from './api.service';
import { UserService } from './user.service';
import { AppNotification, NotificationFeed } from '../../shared/models/notification';

const POLL_MS = 45_000;

/**
 * The notification bell.
 *
 * Polls rather than using WebSockets: a customer's notifications are not
 * urgent to the second, and plain HTTPS works through any proxy or CDN without
 * extra configuration. Forty-five seconds is often enough for "your order
 * shipped" and cheap enough to leave running.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly api = inject(ApiService);
  private readonly users = inject(UserService);

  private readonly feed = signal<AppNotification[]>([]);
  private readonly unread = signal(0);

  readonly items = this.feed.asReadonly();
  readonly unreadCount = this.unread.asReadonly();
  readonly hasUnread = computed(() => this.unread() > 0);

  constructor() {
    // Signed out means nothing to poll for, and no stale list to leave behind.
    effect(() => {
      if (!this.users.isLoggedIn()) {
        this.feed.set([]);
        this.unread.set(0);
      }
    });

    interval(POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.users.isLoggedIn()
            ? this.api.get<NotificationFeed>('me/notifications').pipe(catchError(() => of(null)))
            : of(null),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (!result) return;
        this.feed.set(result.items);
        this.unread.set(result.unreadCount);
      });
  }

  refresh(): void {
    if (!this.users.isLoggedIn()) return;

    this.api.get<NotificationFeed>('me/notifications').subscribe({
      next: (result) => {
        this.feed.set(result.items);
        this.unread.set(result.unreadCount);
      },
    });
  }

  markRead(id: number): void {
    const already = this.feed().find((n) => n.id === id)?.isRead;
    if (already) return;

    this.patch(id, true);
    this.unread.update((n) => Math.max(0, n - 1));

    this.api.put<void>(`me/notifications/${id}/read`, {}).subscribe({
      error: () => {
        this.patch(id, false);
        this.unread.update((n) => n + 1);
      },
    });
  }

  markAllRead(): void {
    if (this.unread() === 0) return;

    const before = this.feed();
    const beforeCount = this.unread();

    this.feed.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.unread.set(0);

    this.api.put<void>('me/notifications/read-all', {}).subscribe({
      error: () => {
        this.feed.set(before);
        this.unread.set(beforeCount);
      },
    });
  }

  private patch(id: number, isRead: boolean): void {
    this.feed.update((list) => list.map((n) => (n.id === id ? { ...n, isRead } : n)));
  }
}
