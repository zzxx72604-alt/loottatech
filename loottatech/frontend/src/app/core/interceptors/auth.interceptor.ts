import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UserService } from '../services/user.service';

/**
 * Attaches the JWT to every request.
 *
 * "Authorization: Bearer <token>" — the format ASP.NET Core's JwtBearer
 * middleware expects. The old Node backend used a custom `access_token`
 * header; that would silently fail here.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const users = inject(UserService);
  const router = inject(Router);
  const token = users.token();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 means the token expired or was rejected — sign out cleanly.
      if (error.status === 401 && users.isLoggedIn()) {
        users.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
