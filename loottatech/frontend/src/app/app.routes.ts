import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Every route uses `loadComponent`, so the browser downloads only the page it
 * is showing. Open DevTools → Network and watch each chunk arrive on click.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'LoottaTech — affordable new & second-hand technology',
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    // :term binds straight into Catalog's `term` @Input, because app.config.ts
    // enables withComponentInputBinding().
    path: 'search/:term',
    title: 'Search — LoottaTech',
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
  },
  {
    // Public share links: /p/pkhj83421
    path: 'p/:code',
    loadComponent: () =>
      import('./features/product-detail/product-detail').then((m) => m.ProductDetail),
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./features/product-detail/product-detail').then((m) => m.ProductDetail),
  },
  {
    path: 'cart',
    title: 'Your cart — LoottaTech',
    loadComponent: () => import('./features/cart/cart').then((m) => m.Cart),
  },
  {
    path: 'checkout',
    title: 'Checkout — LoottaTech',
    loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
  },
  {
    path: 'order/:orderNumber',
    title: 'Your order — LoottaTech',
    loadComponent: () =>
      import('./features/order-confirmation/order-confirmation').then((m) => m.OrderConfirmation),
  },
  {
    path: 'login',
    title: 'Sign in — LoottaTech',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Create account — LoottaTech',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'profile',
    title: 'My profile — LoottaTech',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile').then((m) => m.ProfilePage),
  },
  {
    path: 'settings',
    title: 'Settings — LoottaTech',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'arcade',
    title: 'Lootta Arcade — LoottaTech',
    canActivate: [authGuard],
    loadComponent: () => import('./features/arcade/arcade').then((m) => m.Arcade),
  },
  {
    /*
     * An account page, so it needs an account.
     *
     * Guest checkout still works, and a guest can still track a parcel from
     * the code on their receipt at /order/:orderNumber. What they cannot do
     * is open a history page and be shown somebody's past purchases just
     * because they are sitting at the same computer.
     */
    path: 'my-orders',
    title: 'My orders — LoottaTech',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/my-orders').then((m) => m.MyOrders),
  },
  {
    path: '**',
    title: 'Page not found — LoottaTech',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
