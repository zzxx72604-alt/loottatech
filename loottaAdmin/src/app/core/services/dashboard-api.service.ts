import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Dashboard } from '../../shared/models/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly api = inject(ApiService);

  get(): Observable<Dashboard> {
    return this.api.get<Dashboard>('dashboard');
  }
}
