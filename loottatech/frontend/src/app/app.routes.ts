import { Routes } from '@angular/router';

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
    // Guest checkout only for now — the ASP.NET API has no authentication yet,
    // so "my orders" is looked up from order numbers saved in this browser.
    path: 'my-orders',
    title: 'My orders — LoottaTech',
    loadComponent: () => import('./features/account/my-orders').then((m) => m.MyOrders),
  },
  {
    path: '**',
    title: 'Page not found — LoottaTech',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
