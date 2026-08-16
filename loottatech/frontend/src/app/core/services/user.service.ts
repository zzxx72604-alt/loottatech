import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { LoginRequest, RegisterRequest, User } from '../../shared/models/user';

const STORAGE_KEY = 'lootta-user';

/**
 * Who is signed in, as a signal.
 *
 * Any component can read `user()` or `isAdmin()` straight in its template and
 * Angular keeps it up to date — no subscriptions to manage or unsubscribe.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  private readonly current = signal<User | null>(this.restore());

  readonly user = this.current.asReadonly();
  readonly isLoggedIn = computed(() => this.current() !== null);
  readonly isAdmin = computed(() => this.current()?.isAdmin === true);
  readonly token = computed(() => this.current()?.token ?? null);

  login(credentials: LoginRequest): Observable<User> {
    return this.api
      .post<User>('users/login', credentials)
      .pipe(tap((user) => this.persist(user)));
  }

  register(details: RegisterRequest): Observable<User> {
    return this.api
      .post<User>('users/register', details)
      .pipe(tap((user) => this.persist(user)));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.current.set(null);
  }

  private persist(user: User): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.current.set(user);
  }

  private restore(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
