import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthUser, LoginRequest } from '../../shared/models/user';

const STORAGE_KEY = 'lootta-admin-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  private readonly current = signal<AuthUser | null>(this.restore());

  readonly user = this.current.asReadonly();
  readonly isLoggedIn = computed(() => this.current() !== null);
  readonly isAdmin = computed(() => this.current()?.role === 'Admin');
  readonly token = computed(() => this.current()?.token ?? null);

  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.api
      .post<AuthUser>('auth/login', credentials)
      .pipe(tap((user) => this.persist(user)));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.current.set(null);
  }

  private persist(user: AuthUser): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    this.current.set(user);
  }

  /**
   * Reads the saved session, but throws it away if the token has expired —
   * otherwise the app would look logged in and then fail every request.
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
