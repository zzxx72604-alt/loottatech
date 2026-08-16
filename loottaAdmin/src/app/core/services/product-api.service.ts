import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Category, Product, ProductDetail, ProductWrite } from '../../shared/models/product';

@Injectable({ providedIn: 'root' })
export class ProductApi {
  private readonly api = inject(ApiService);

  /** includeInactive=true so the admin sees hidden products too. */
  list(search = ''): Observable<Product[]> {
    return this.api.get<Product[]>('products', { search, includeInactive: true });
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
}

@Injectable({ providedIn: 'root' })
export class CategoryApi {
  private readonly api = inject(ApiService);

  list(): Observable<Category[]> {
    return this.api.get<Category[]>('categories');
  }
}
