import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomerApi } from '../../core/services/customer-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CustomerDetail, CustomerRow } from '../../shared/models/customer';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-customer-list',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerList {
  private readonly api = inject(CustomerApi);
  protected readonly auth = inject(AuthService);

  protected readonly rows = signal<CustomerRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly selected = signal<CustomerDetail | null>(null);
  protected readonly detailLoading = signal(false);

  protected term = '';

  /**
   * Typing fires a stream, not a request per keystroke.
   *
   *   debounceTime      — wait until they stop typing
   *   distinctUntilChanged — ignore a repeat of the same term
   *   switchMap         — cancel the previous search, so a slow early
   *                       response can never overwrite a newer one
   */
  private readonly typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.api.search(term)),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(this.explain(err));
          this.loading.set(false);
        },
      });

    this.search('');
  }

  protected search(term: string): void {
    this.loading.set(true);
    this.error.set('');
    this.typed.next(term);
  }

  protected open(row: CustomerRow): void {
    if (this.selected()?.id === row.id) {
      this.selected.set(null);
      return;
    }

    this.detailLoading.set(true);
    this.selected.set(null);

    this.api.get(row.id).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.error.set(this.explain(err));
        this.detailLoading.set(false);
      },
    });
  }

  protected toggleActive(customer: CustomerDetail): void {
    const next = !customer.isActive;

    this.api.setActive(customer.id, next).subscribe({
      next: () => {
        this.selected.update((c) => (c ? { ...c, isActive: next } : c));
        this.rows.update((list) =>
          list.map((r) => (r.id === customer.id ? { ...r, isActive: next } : r)),
        );
      },
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected readonly fileBase = environment.fileBase;

  protected avatar(url: string): string {
    return url ? `${this.fileBase}${url}-480.webp` : '';
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  /* -------------------------------------------------------- admin tools */

  /**
   * Sets a temporary password.
   *
   * The admin never sees the old one — it is a BCrypt hash and cannot be
   * read back. This overwrites it, which is the only honest way to help
   * someone locked out.
   */
  protected resetPassword(customer: CustomerDetail): void {
    const password = prompt(
      `Set a temporary password for ${customer.name}.\nTell them to change it after signing in.`,
      '',
    );

    if (password === null) return;
    if (password.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }

    this.api.resetPassword(customer.id, password).subscribe({
      next: () => this.error.set(''),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected changeRole(customer: CustomerDetail): void {
    const next = customer.role === 'Admin' ? 'Customer' : 'Admin';

    if (!confirm(`Change ${customer.name} to ${next}?`)) return;

    this.api.setRole(customer.id, next).subscribe({
      next: () => this.selected.update((c) => (c ? { ...c, role: next } : c)),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  protected copyCode(code: string): void {
    navigator.clipboard?.writeText(code);
  }

  protected isSelf(id: number): boolean {
    return this.auth.user()?.id === id;
  }

  protected statusClass(status: string): string {
    return 's-' + status.toLowerCase();
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown; message?: string };

    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (e.status === 401) return 'Not signed in, or the token expired. Sign in again.';
    if (e.status === 403) return 'This account is not allowed to do that.';
    if (typeof e.error === 'string' && e.error) return e.error;

    const problem = e.error as { title?: string; detail?: string } | undefined;
    if (problem?.detail) return `${e.status}: ${problem.detail}`;
    if (problem?.title) return `${e.status}: ${problem.title}`;

    return `Request failed with status ${e.status ?? 'unknown'}. Check the API terminal.`;
  }
}
