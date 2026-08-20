import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CustomerDetail, CustomerRow } from '../../shared/models/customer';

@Injectable({ providedIn: 'root' })
export class CustomerApi {
  private readonly api = inject(ApiService);

  /** Search runs in SQL — we never pull the whole table into the browser. */
  search(term = ''): Observable<CustomerRow[]> {
    return this.api.get<CustomerRow[]>('auth/users', { search: term });
  }

  get(id: number): Observable<CustomerDetail> {
    return this.api.get<CustomerDetail>(`auth/users/${id}`);
  }

  setActive(id: number, value: boolean): Observable<void> {
    return this.api.put<void>(`auth/users/${id}/active?value=${value}`, {});
  }

  /** Overwrites the password. The old one is a hash and cannot be read back. */
  resetPassword(id: number, newPassword: string): Observable<void> {
    return this.api.put<void>(`auth/users/${id}/password`, { newPassword });
  }

  setRole(id: number, role: 'Customer' | 'Admin'): Observable<void> {
    return this.api.put<void>(`auth/users/${id}/role`, { role });
  }
}
