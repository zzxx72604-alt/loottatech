import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomerApi } from '../../core/services/customer-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CustomerDetail, CustomerRow } from '../../shared/models/customer';

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

  protected isSelf(id: number): boolean {
    return this.auth.user()?.id === id;
  }

  protected statusClass(status: string): string {
    return 's-' + status.toLowerCase();
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown };
    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (typeof e.error === 'string') return e.error;
    return 'Something went wrong.';
  }
}
