import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'map' },
  {
    path: 'map',
    title: 'Map · FieldIQ',
    loadComponent: () => import('./features/map/map.page').then((m) => m.MapPage),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · FieldIQ',
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'sites',
    title: 'Sites · FieldIQ',
    loadComponent: () => import('./features/sites/sites.page').then((m) => m.SitesPage),
  },
  {
    path: 'devices',
    title: 'Devices · FieldIQ',
    loadComponent: () => import('./features/devices/devices.page').then((m) => m.DevicesPage),
  },
  {
    path: 'alerts',
    title: 'Alerts · FieldIQ',
    loadComponent: () => import('./features/alerts/alerts.page').then((m) => m.AlertsPage),
  },
  { path: '**', redirectTo: 'map' },
];
