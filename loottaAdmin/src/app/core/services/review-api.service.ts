import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { AdminReview } from '../../shared/models/review';

@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly api = inject(ApiService);

  list(search = '', onlyHidden = false): Observable<AdminReview[]> {
    return this.api.get<AdminReview[]>('admin/reviews', { search, onlyHidden });
  }

  /**
   * Reviews for one product.
   *
   * Filtered client-side from the recent list rather than adding another
   * endpoint — the admin list is already capped and this avoids a second way
   * of asking the same question.
   */
  forProduct(productId: number): Observable<AdminReview[]> {
    return this.api
      .get<AdminReview[]>('admin/reviews', { take: 300 })
      .pipe(map((rows) => rows.filter((r) => r.productId === productId)));
  }

  setHidden(id: number, value: boolean): Observable<void> {
    return this.api.put<void>(`admin/reviews/${id}/hidden?value=${value}`, {});
  }

  remove(id: number): Observable<void> {
    return this.api.delete<void>(`admin/reviews/${id}`);
  }
}
