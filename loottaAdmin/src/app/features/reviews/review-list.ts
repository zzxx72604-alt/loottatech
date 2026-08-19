import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReviewApi } from '../../core/services/review-api.service';
import { AdminReview } from '../../shared/models/review';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-review-list',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './review-list.html',
  styleUrl: './review-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewList {
  private readonly api = inject(ReviewApi);

  protected readonly rows = signal<AdminReview[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly onlyHidden = signal(false);

  protected term = '';
  private readonly typed = new Subject<string>();

  protected readonly fileBase = environment.fileBase;

  protected readonly hiddenCount = computed(() => this.rows().filter((r) => r.isHidden).length);
  protected readonly lowRated = computed(() => this.rows().filter((r) => r.rating <= 2).length);

  constructor() {
    this.typed
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        // Cancels the previous search, so a slow early reply can't overwrite
        // the results for what the admin is actually typing now.
        switchMap((term) => this.api.list(term, this.onlyHidden())),
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

  protected toggleHiddenFilter(): void {
    this.onlyHidden.update((v) => !v);
    this.search(this.term);
  }

  protected stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  protected image(url: string): string {
    return url ? `${this.fileBase}${url}-480.webp` : '';
  }

  protected toggle(review: AdminReview): void {
    const next = !review.isHidden;

    // Flip immediately, roll back if the API refuses.
    this.patch(review.id, { isHidden: next });

    this.api.setHidden(review.id, next).subscribe({
      error: (err) => {
        this.patch(review.id, { isHidden: !next });
        this.error.set(this.explain(err));
      },
    });
  }

  protected remove(review: AdminReview): void {
    if (!confirm(`Delete this review permanently? Hiding it is usually enough.`)) return;

    this.api.remove(review.id).subscribe({
      next: () => this.rows.update((list) => list.filter((r) => r.id !== review.id)),
      error: (err) => this.error.set(this.explain(err)),
    });
  }

  private patch(id: number, changes: Partial<AdminReview>): void {
    this.rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  private explain(err: unknown): string {
    const e = err as { status?: number; error?: unknown };

    if (e.status === 0) return 'Cannot reach the API. Is it running on http://localhost:5197 ?';
    if (e.status === 401) return 'Not signed in, or the token expired. Sign in again.';
    if (e.status === 403) return 'This account is not allowed to do that.';
    if (typeof e.error === 'string' && e.error) return e.error;

    return `Request failed with status ${e.status ?? 'unknown'}.`;
  }
}
