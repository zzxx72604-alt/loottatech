import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReviewApi } from '../../core/services/review-api.service';
import { AdminReview } from '../../shared/models/review';
import { environment } from '../../../environments/environment';

/**
 * The reviews for one product, shown inside its edit page.
 *
 * The shop-wide Reviews screen is for moderation sweeps. This is for the
 * question an admin actually asks while looking at a product: what are people
 * saying about this one?
 */
@Component({
  selector: 'app-product-reviews',
  imports: [DatePipe],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductReviews {
  private readonly api = inject(ReviewApi);

  private id = 0;

  @Input({ required: true }) set productId(value: number | null) {
    if (!value) return;
    this.id = value;
    this.load();
  }

  protected readonly rows = signal<AdminReview[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  private readonly fileBase = environment.fileBase;

  /** Average of the VISIBLE reviews — the same figure customers see. */
  protected readonly average = computed(() => {
    const visible = this.rows().filter((r) => !r.isHidden);
    if (visible.length === 0) return 0;

    const total = visible.reduce((sum, r) => sum + r.rating, 0);
    return Math.round((total / visible.length) * 10) / 10;
  });

  protected readonly visibleCount = computed(() => this.rows().filter((r) => !r.isHidden).length);
  protected readonly hiddenCount = computed(() => this.rows().filter((r) => r.isHidden).length);

  protected load(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.forProduct(this.id).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load reviews.');
        this.loading.set(false);
      },
    });
  }

  protected stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  protected image(url: string): string {
    return url ? `${this.fileBase}${url}-480.webp` : '';
  }

  protected toggle(review: AdminReview): void {
    const next = !review.isHidden;
    this.patch(review.id, { isHidden: next });

    this.api.setHidden(review.id, next).subscribe({
      error: () => {
        this.patch(review.id, { isHidden: !next });
        this.error.set('Could not update that review.');
      },
    });
  }

  protected remove(review: AdminReview): void {
    if (!confirm('Delete this review permanently? Hiding it is usually enough.')) return;

    this.api.remove(review.id).subscribe({
      next: () => this.rows.update((list) => list.filter((r) => r.id !== review.id)),
      error: () => this.error.set('Could not delete that review.'),
    });
  }

  private patch(id: number, changes: Partial<AdminReview>): void {
    this.rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }
}
