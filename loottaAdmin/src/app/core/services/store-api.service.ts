import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Category {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
}

export interface CategoryWrite {
  name: string;
  slug: string;
  sortOrder: number;
}

export interface QuickTag {
  id: number;
  label: string;
  query: string;
  sortOrder: number;
  isActive: boolean;
}

export interface QuickTagWrite {
  label: string;
  query: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SiteText {
  key: string;
  value: string;
  description: string;
  defaultValue: string;
}

export interface PaymentMethodSetting {
  method: string;
  label: string;
  note: string;
  group: string;
  isEnabled: boolean;
  sortOrder: number;
}

/** Everything on the Store page: categories, tags, wording, payment methods. */
@Injectable({ providedIn: 'root' })
export class StoreApi {
  private readonly api = inject(ApiService);

  /* ------------------------------------------------------- categories */

  categories(): Observable<Category[]> {
    return this.api.get<Category[]>('categories');
  }

  createCategory(body: CategoryWrite): Observable<Category> {
    return this.api.post<Category>('categories', body);
  }

  updateCategory(id: number, body: CategoryWrite): Observable<void> {
    return this.api.put<void>(`categories/${id}`, body);
  }

  /** Refused by the API if the category still holds products. */
  deleteCategory(id: number): Observable<void> {
    return this.api.delete<void>(`categories/${id}`);
  }

  /* -------------------------------------------------------- quick tags */

  tags(): Observable<QuickTag[]> {
    return this.api.get<QuickTag[]>('store/tags/all');
  }

  createTag(body: QuickTagWrite): Observable<QuickTag> {
    return this.api.post<QuickTag>('store/tags', body);
  }

  updateTag(id: number, body: QuickTagWrite): Observable<void> {
    return this.api.put<void>(`store/tags/${id}`, body);
  }

  deleteTag(id: number): Observable<void> {
    return this.api.delete<void>(`store/tags/${id}`);
  }

  /* --------------------------------------------------------- shop text */

  texts(): Observable<SiteText[]> {
    return this.api.get<SiteText[]>('store/text/all');
  }

  saveTexts(values: Record<string, string>): Observable<void> {
    return this.api.put<void>('store/text', values);
  }

  /* --------------------------------------------------- payment methods */

  paymentMethods(): Observable<PaymentMethodSetting[]> {
    return this.api.get<PaymentMethodSetting[]>('store/payment-methods');
  }

  savePaymentMethods(rows: PaymentMethodSetting[]): Observable<void> {
    return this.api.put<void>(
      'store/payment-methods',
      rows.map((r) => ({ method: r.method, isEnabled: r.isEnabled, sortOrder: r.sortOrder })),
    );
  }
}
