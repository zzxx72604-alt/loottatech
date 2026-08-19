import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { Product } from '../../shared/models/product';

export interface ProductPage {
  items: Product[];
  total: number;
  hasMore: boolean;
}

export interface ProductQuery {
  search?: string;
  categoryId?: number;
  condition?: string;
  maxPrice?: number;
  sort?: string;
  skip?: number;
  take?: number;
}

/**
 * Talks to the ASP.NET Core API.
 *
 * Only ACTIVE products come back — the API hides anything the admin has
 * switched off, so the customer never sees a hidden listing.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);

  /** One page, with the filters applied by the database. */
  page(query: ProductQuery = {}): Observable<ProductPage> {
    return this.api.get<ProductPage>('products', {
      search: query.search ?? '',
      categoryId: query.categoryId ?? 0,
      condition: query.condition ?? '',
      maxPrice: query.maxPrice ?? 0,
      sort: query.sort ?? '',
      skip: query.skip ?? 0,
      take: query.take ?? 24,
    });
  }

  /** Everything, for the search index. Fine at this size; paged elsewhere. */
  getAll(): Observable<Product[]> {
    return this.api.get<ProductPage>('products', { take: 60 }).pipe(map((p) => p.items));
  }

  getById(id: number | string): Observable<Product> {
    return this.api.get<Product>(`products/${id}`);
  }

  /** Products to suggest alongside this one. */
  related(id: number): Observable<Product[]> {
    return this.api.get<Product[]>(`products/${id}/related`);
  }

  /** Resolves a share link like /p/pkhj83421. */
  getByCode(code: string): Observable<Product> {
    return this.api.get<Product>(`products/code/${code}`);
  }


}
