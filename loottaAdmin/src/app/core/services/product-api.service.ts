import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import {
  Category,
  Product,
  ProductDetail,
  ProductImage,
  ProductWrite,
} from '../../shared/models/product';

@Injectable({ providedIn: 'root' })
export class ProductApi {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /** includeInactive=true so the admin sees hidden products too. */
  /**
   * The API now returns a PAGE rather than a bare array. The admin still wants
   * one flat list, so it asks for a large page and unwraps it here — one place
   * to change if the admin ever needs its own paging.
   */
  list(search = ''): Observable<Product[]> {
    return this.api
      .get<{ items: Product[]; total: number; hasMore: boolean }>('products', {
        search,
        includeInactive: true,
        take: 60,
      })
      .pipe(map((page) => page.items));
  }

  get(id: number): Observable<ProductDetail> {
    return this.api.get<ProductDetail>(`products/${id}`);
  }

  create(body: ProductWrite): Observable<ProductDetail> {
    return this.api.post<ProductDetail>('products', body);
  }

  update(id: number, body: ProductWrite): Observable<ProductDetail> {
    return this.api.put<ProductDetail>(`products/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.api.delete<void>(`products/${id}`);
  }

  setActive(id: number, value: boolean): Observable<void> {
    return this.api.put<void>(`products/${id}/active?value=${value}`, {});
  }

  /* ------------------------------------------------------------- images */

  /**
   * Uploads with multipart/form-data.
   *
   * Note there is no Content-Type header set by hand. The browser has to add
   * it itself, because it also has to append the multipart boundary string —
   * setting it manually is the classic way to break a file upload.
   *
   * `reportProgress` gives us upload events so the UI can show a bar rather
   * than freezing on a large photo.
   */
  uploadImage(
    productId: number,
    file: File,
    crop?: { x: number; y: number; size: number },
  ): Observable<HttpEvent<ProductImage>> {
    const body = new FormData();
    body.append('file', file, file.name);
    this.appendCrop(body, crop);

    return this.http.post<ProductImage>(
      `${environment.apiBase}/products/${productId}/images`,
      body,
      { reportProgress: true, observe: 'events' },
    );
  }

  replaceImage(
    productId: number,
    imageId: number,
    file: File,
    crop?: { x: number; y: number; size: number },
  ): Observable<HttpEvent<ProductImage>> {
    const body = new FormData();
    body.append('file', file, file.name);
    this.appendCrop(body, crop);

    return this.http.put<ProductImage>(
      `${environment.apiBase}/products/${productId}/images/${imageId}`,
      body,
      { reportProgress: true, observe: 'events' },
    );
  }

  /** Fractions of the source image; omitted means "centre crop". */
  private appendCrop(body: FormData, crop?: { x: number; y: number; size: number }): void {
    if (!crop) return;

    body.append('cropX', String(crop.x));
    body.append('cropY', String(crop.y));
    body.append('cropSize', String(crop.size));
  }

  deleteImage(productId: number, imageId: number): Observable<void> {
    return this.api.delete<void>(`products/${productId}/images/${imageId}`);
  }

  setPrimaryImage(productId: number, imageId: number): Observable<void> {
    return this.api.put<void>(`products/${productId}/images/${imageId}/primary`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class CategoryApi {
  private readonly api = inject(ApiService);

  list(): Observable<Category[]> {
    return this.api.get<Category[]>('categories');
  }
}
