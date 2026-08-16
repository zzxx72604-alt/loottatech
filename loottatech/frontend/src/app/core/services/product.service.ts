import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Product } from '../../shared/models/product';

/**
 * Talks to the ASP.NET Core API.
 *
 * Only ACTIVE products come back — the API hides anything the admin has
 * switched off, so the customer never sees a hidden listing.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);

  getAll(): Observable<Product[]> {
    return this.api.get<Product[]>('products');
  }

  getById(id: number | string): Observable<Product> {
    return this.api.get<Product>(`products/${id}`);
  }

  /** The C# API filters with a query parameter, not a path segment. */
  search(term: string): Observable<Product[]> {
    return this.api.get<Product[]>('products', { search: term });
  }

  byCategory(categoryId: number): Observable<Product[]> {
    return this.api.get<Product[]>('products', { categoryId });
  }
}
