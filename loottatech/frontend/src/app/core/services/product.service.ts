import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Product } from '../../shared/models/product';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);

  getAll(): Observable<Product[]> {
    return this.api.get<Product[]>('products');
  }

  getById(id: string): Observable<Product> {
    return this.api.get<Product>(`products/${id}`);
  }

  search(term: string): Observable<Product[]> {
    return this.api.get<Product[]>(`products/search/${encodeURIComponent(term)}`);
  }

  create(product: Partial<Product>): Observable<Product> {
    return this.api.post<Product>('products', product);
  }

  update(id: string, product: Partial<Product>): Observable<Product> {
    return this.api.put<Product>(`products/${id}`, product);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`products/${id}`);
  }
}
