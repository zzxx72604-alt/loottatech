import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Keeps the admin screens behind a login.
 *
 * This is convenience, not security — the API enforces the real rule. Even if
 * someone bypassed this guard, every write endpoint would still return 403.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
