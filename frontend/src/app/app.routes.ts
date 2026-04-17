import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'category', pathMatch: 'full' },
  {
    path: 'category',
    loadComponent: () =>
      import('./components/category/category.component').then((m) => m.CategoryComponent),
  },
  {
    path: 'unit',
    loadComponent: () =>
      import('./components/unit/unit.component').then((m) => m.UnitComponent),
  },
  {
    path: 'parameter',
    loadComponent: () =>
      import('./components/parameter/parameter.component').then((m) => m.ParameterComponent),
  },
  {
    path: 'product',
    loadComponent: () =>
      import('./components/product/product.component').then((m) => m.ProductComponent),
  },
  {
    path: 'header-info',
    loadComponent: () =>
      import('./components/header-info/header-info.component').then((m) => m.HeaderInfoComponent),
  },
];
