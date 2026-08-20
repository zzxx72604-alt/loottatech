import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { GuestOrderStore } from './guest-orders.service';
import { AuthUser, LoginRequest, RegisterRequest } from '../../shared/models/user';

const STORAGE_KEY = 'lootta-user';

/**
 * Who is signed in, as a signal.
 *
 * Any component reads `user()` or `coins()` straight in its template and
 * Angular keeps it current — no subscriptions to manage.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);
  private readonly guests = inject(GuestOrderStore);

  private readonly current = signal<AuthUser | null>(this.restore());

  readonly user = this.current.asReadonly();
  readonly isLoggedIn = computed(() => this.current() !== null);
  readonly token = computed(() => this.current()?.token ?? null);
  readonly coins = computed(() => this.current()?.coins ?? 0);

  /**
   * Profile picture path, or empty.
   *
   * Login does not return it, so it is filled in when the profile or settings
   * page loads. The header then shows the picture instead of initials without
   * fetching anything itself.
   */
  private readonly avatar = signal('');
  readonly avatarUrl = this.avatar.asReadonly();

  setAvatar(url: string): void {
    this.avatar.set(url ?? '');
  }

  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.api.post<AuthUser>('auth/login', credentials).pipe(tap((u) => this.persist(u)));
  }

  register(details: RegisterRequest): Observable<AuthUser> {
    return this.api.post<AuthUser>('auth/register', details).pipe(tap((u) => this.persist(u)));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);

    // Guest order codes go too. Leaving them behind means the next person to
    // open this browser sees what was bought and for how much.
    this.guests.clear();

    this.current.set(null);
  }

  /** Keeps the header in step after the customer renames themselves. */
  setName(name: string): void {
    const user = this.current();
    if (!user) return;

    const updated = { ...user, name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.current.set(updated);
  }

  /** Keeps the header balance in step after playing or redeeming. */
  setCoins(coins: number): void {
    const user = this.current();
    if (!user) return;

    const updated = { ...user, coins };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.current.set(updated);
  }

  private persist(user: AuthUser): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.current.set(user);
  }

  /**
   * Restores the saved session, but discards it if the token has expired —
   * otherwise the app looks signed in and then fails every request.
   */
  private restore(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const user = JSON.parse(raw) as AuthUser;
      if (new Date(user.expiresAt) <= new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }
}
