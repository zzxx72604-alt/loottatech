import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { Product } from '../../shared/models/product';
import { EditableProfile, Profile } from '../../shared/models/profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  get(): Observable<Profile> {
    return this.api.get<Profile>('me/profile');
  }

  likes(): Observable<Product[]> {
    return this.api.get<Product[]>('me/likes');
  }

  saves(): Observable<Product[]> {
    return this.api.get<Product[]>('me/saves');
  }

  /** Unmasked details for editing. Separate from get(), which masks the phone. */
  editable(): Observable<EditableProfile> {
    return this.api.get<EditableProfile>('me/editable');
  }

  update(body: {
    name: string;
    phone: string;
    address: string;
    gender: string;
  }): Observable<EditableProfile> {
    return this.api.put<EditableProfile>('me/profile', body);
  }

  uploadAvatar(file: File): Observable<EditableProfile> {
    const form = new FormData();
    form.append('file', file, file.name);

    // No Content-Type header: the browser must set it so the multipart
    // boundary is generated correctly.
    return this.http.post<EditableProfile>(`${environment.apiBase}/me/avatar`, form);
  }
}
