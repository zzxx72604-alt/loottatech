import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  {
    path: 'products',
    title: 'Products — LoottaTech Admin',
    loadComponent: () =>
      import('./features/products/product-list').then((m) => m.ProductList),
  },
  {
    path: 'products/new',
    title: 'New product — LoottaTech Admin',
    loadComponent: () =>
      import('./features/products/product-form').then((m) => m.ProductForm),
  },
  {
    path: 'products/:id',
    title: 'Edit product — LoottaTech Admin',
    loadComponent: () =>
      import('./features/products/product-form').then((m) => m.ProductForm),
  },
  {
    path: 'orders',
    title: 'Orders — LoottaTech Admin',
    loadComponent: () => import('./features/orders/order-list').then((m) => m.OrderList),
  },
  { path: '**', redirectTo: 'products' },
];
