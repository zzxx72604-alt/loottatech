import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * One thin wrapper over HttpClient for the whole app.
 *
 * Feature services (ProductService, OrderService, ...) call this instead of
 * injecting HttpClient themselves, so the base URL and error handling live in
 * exactly one file.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /**
   * The single place the app knows a backend exists.
   *
   * Every HTTP call in LoottaTech goes through this class, so replacing the
   * Express API with an ASP.NET Core one means editing this constant and the
   * proxy target — nothing else.
   */
  private readonly base = environment.apiBase;

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.http
      .get<T>(`${this.base}/${path}`, { params: this.toParams(params) })
      .pipe(catchError(this.handle));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body).pipe(catchError(this.handle));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${path}`, body).pipe(catchError(this.handle));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/${path}`).pipe(catchError(this.handle));
  }

  private toParams(params?: Record<string, string | number | boolean>): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;
    for (const [key, value] of Object.entries(params)) {
      if (value !== '' && value !== null && value !== undefined) {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  private handle(error: unknown) {
    console.error('[ApiService]', error);
    return throwError(() => error);
  }
}
