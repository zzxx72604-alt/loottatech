import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user.service';

/** Blocks a route unless someone is signed in, then sends them to login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const users = inject(UserService);
  const router = inject(Router);

  if (users.isLoggedIn()) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Same, but also requires the admin flag carried in the JWT. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const users = inject(UserService);
  const router = inject(Router);

  if (users.isAdmin()) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
