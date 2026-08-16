import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user.service';

/**
 * Blocks a route unless someone is signed in, then sends them to login with a
 * returnUrl so they land back where they were trying to go.
 *
 * This is convenience, not security — the API enforces the real rule. Every
 * protected endpoint returns 401 without a valid token, guard or no guard.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const users = inject(UserService);
  const router = inject(Router);

  if (users.isLoggedIn()) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
