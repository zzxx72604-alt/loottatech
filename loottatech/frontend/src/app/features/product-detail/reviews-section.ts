import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ReviewService } from '../../core/services/review.service';
import { UserService } from '../../core/services/user.service';
import { RatingSummary, Review } from '../../shared/models/review';
import { StarRating } from '../../shared/components/star-rating/star-rating';

const PAGE = 3;

/**
 * Reviews for one product: the score breakdown, a short list with "see more",
 * and the write form for customers who bought it.
 *
 * Only three reviews load with the page. Fetching two hundred that nobody
 * scrolls to would cost every visitor bandwidth for nothing.
 */
@Component({
  selector: 'app-reviews-section',
  imports: [DatePipe, FormsModule, RouterLink, StarRating],
  templateUrl: './reviews-section.html',
  styleUrl: './reviews-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsSection {
  private readonly api = inject(ReviewService);
  protected readonly users = inject(UserService);

  @ViewChild('picker') private picker?: ElementRef<HTMLInputElement>;

  private id = 0;

  @Input({ required: true }) set productId(value: number) {
    this.id = value;
    this.reset();
    this.loadMore();
  }

  protected readonly reviews = signal<Review[]>([]);
  protected readonly summary = signal<RatingSummary | null>(null);
  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);

  // ---- write form ----
  protected readonly writing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected draftRating = 0;
  protected draftBody = '';
  protected readonly pendingPhoto = signal<string | null>(null);
  private photoFile: File | null = null;

  protected readonly stars = [5, 4, 3, 2, 1];

  /**
   * Review photos use the same sizing convention as product images. The path
   * stays relative because the dev server proxies /uploads to the API, so the
   * browser sees it as same-origin.
   */
  protected image(url: string): string {
    return `${url}-480.webp`;
  }

  private reset(): void {
    this.reviews.set([]);
    this.total.set(0);
    this.hasMore.set(false);
    this.loading.set(true);
    this.writing.set(false);
    this.draftRating = 0;
    this.draftBody = '';
    this.clearPhoto();
  }

  protected loadMore(): void {
    this.api.page(this.id, this.reviews().length, PAGE).subscribe({
      next: (page) => {
        this.reviews.update((list) => [...list, ...page.reviews]);
        this.summary.set(page.summary);
        this.total.set(page.total);
        this.hasMore.set(page.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Bar width for the distribution rows. Index 0 is one star. */
  protected percent(starValue: number): number {
    return this.summary()?.percentages[starValue - 1] ?? 0;
  }

  protected countFor(starValue: number): number {
    return this.summary()?.distribution[starValue - 1] ?? 0;
  }

  /* -------------------------------------------------------- write flow */

  protected startWriting(): void {
    this.writing.set(true);
    this.error.set('');
  }

  protected pickPhoto(): void {
    this.picker?.nativeElement.click();
  }

  protected onPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.clearPhoto();
    this.photoFile = file;
    this.pendingPhoto.set(URL.createObjectURL(file));
  }

  protected clearPhoto(): void {
    const preview = this.pendingPhoto();
    // Release the blob or the file stays in memory for the life of the tab.
    if (preview) URL.revokeObjectURL(preview);

    this.pendingPhoto.set(null);
    this.photoFile = null;
  }

  protected submit(): void {
    if (this.draftRating < 1) {
      this.error.set('Choose a star rating first.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');

    this.api.write(this.id, this.draftRating, this.draftBody).subscribe({
      next: (review) => {
        // The photo needs a review row to attach to, so it goes second.
        if (this.photoFile) this.attachPhoto(review);
        else this.finishWrite(review);
      },
      error: (err) => {
        const e = err as { error?: unknown };
        this.error.set(typeof e.error === 'string' ? e.error : 'Could not post your review.');
        this.submitting.set(false);
      },
    });
  }

  private attachPhoto(review: Review): void {
    this.api.uploadImage(this.id, review.id, this.photoFile!).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response && event.body) {
          this.finishWrite(event.body);
        }
      },
      // The review already exists; a failed photo shouldn't lose the text.
      error: () => this.finishWrite(review),
    });
  }

  private finishWrite(review: Review): void {
    this.reviews.update((list) => [review, ...list]);
    this.total.update((n) => n + 1);

    this.clearPhoto();
    this.draftRating = 0;
    this.draftBody = '';
    this.writing.set(false);
    this.submitting.set(false);

    // Re-read the summary so the average and bars reflect the new review.
    this.api.page(this.id, 0, 1).subscribe({
      next: (page) => this.summary.set(page.summary),
    });
  }

  protected remove(review: Review): void {
    if (!confirm('Delete your review?')) return;

    this.api.remove(this.id, review.id).subscribe({
      next: () => {
        this.reviews.update((list) => list.filter((r) => r.id !== review.id));
        this.total.update((n) => Math.max(0, n - 1));

        this.api.page(this.id, 0, 1).subscribe({
          next: (page) => this.summary.set(page.summary),
        });
      },
    });
  }
}
