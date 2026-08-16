import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    title: 'Sign in — LoottaTech Admin',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    canActivate: [adminGuard],
    title: 'Dashboard — LoottaTech Admin',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'products',
    canActivate: [adminGuard],
    title: 'Products — LoottaTech Admin',
    loadComponent: () =>
      import('./features/products/product-list').then((m) => m.ProductList),
  },
  {
    path: 'products/new',
    canActivate: [adminGuard],
    title: 'New product — LoottaTech Admin',
    loadComponent: () =>
      import('./features/products/product-form').then((m) => m.ProductForm),
  },
  {
    path: 'products/:id',
    canActivate: [adminGuard],
    title: 'Edit product — LoottaTech Admin',
    loadComponent: () =>
      import('./features/products/product-form').then((m) => m.ProductForm),
  },
  {
    path: 'orders',
    canActivate: [adminGuard],
    title: 'Orders — LoottaTech Admin',
    loadComponent: () => import('./features/orders/order-list').then((m) => m.OrderList),
  },
  {
    path: 'customers',
    canActivate: [adminGuard],
    title: 'Customers — LoottaTech Admin',
    loadComponent: () =>
      import('./features/customers/customer-list').then((m) => m.CustomerList),
  },
  { path: '**', redirectTo: 'dashboard' },
];
