import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'category', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'category',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/category/category.component').then((m) => m.CategoryComponent),
  },
  {
    path: 'unit',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/unit/unit.component').then((m) => m.UnitComponent),
  },
  {
    path: 'parameter',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/parameter/parameter.component').then((m) => m.ParameterComponent),
  },
  {
    path: 'product',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/product/product.component').then((m) => m.ProductComponent),
  },
  {
    path: 'report/:id',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/product-report/product-report.component').then((m) => m.ProductReportComponent),
  },
  {
    path: 'header-info',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/header-info/header-info.component').then((m) => m.HeaderInfoComponent),
  },
  {
    path: 'report-builder',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/report-builder/report-builder').then((m) => m.ReportBuilder),
  },
  {
    path: 'report-history/:id',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/report-history-view/report-history-view.component').then((m) => m.ReportHistoryViewComponent),
  },
  {
    path: 'master-product',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./components/master-product/master-product.component').then((m) => m.MasterProductComponent),
  },
];
