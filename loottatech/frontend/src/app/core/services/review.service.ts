import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { Review, ReviewPage } from '../../shared/models/review';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  page(productId: number, skip = 0, take = 3): Observable<ReviewPage> {
    return this.api.get<ReviewPage>(`products/${productId}/reviews`, { skip, take });
  }

  write(productId: number, rating: number, body: string): Observable<Review> {
    return this.api.post<Review>(`products/${productId}/reviews`, { rating, body });
  }

  /** Photo goes up as a second step, once the review row exists to attach it to. */
  uploadImage(productId: number, reviewId: number, file: File): Observable<HttpEvent<Review>> {
    const form = new FormData();
    form.append('file', file, file.name);

    return this.http.post<Review>(
      `${environment.apiBase}/products/${productId}/reviews/${reviewId}/image`,
      form,
      { reportProgress: true, observe: 'events' },
    );
  }

  remove(productId: number, reviewId: number): Observable<void> {
    return this.api.delete<void>(`products/${productId}/reviews/${reviewId}`);
  }
}
