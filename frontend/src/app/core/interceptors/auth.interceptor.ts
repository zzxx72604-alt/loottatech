import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { UserService } from '../services/user.service';

/**
 * Attaches the JWT to every outgoing request.
 *
 * NOTE the header name. This backend reads `access_token`, not the usual
 * `Authorization: Bearer ...`. Get this wrong and protected calls fail with a
 * bare 401 and no message, which is painful to debug.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(UserService).token();

  if (!token) return next(req);

  return next(
    req.clone({
      setHeaders: { access_token: token },
    }),
  );
};
