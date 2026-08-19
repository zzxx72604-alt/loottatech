import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Report } from '../../shared/models/report';

@Injectable({ providedIn: 'root' })
export class ReportApi {
  private readonly api = inject(ApiService);

  list(openOnly = true): Observable<Report[]> {
    return this.api.get<Report[]>('reports', { openOnly });
  }

  resolve(id: number, status: 'Actioned' | 'Dismissed', resolution: string): Observable<void> {
    return this.api.put<void>(`reports/${id}/resolve`, { status, resolution });
  }
}
