import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/links/pages/dashboard/dashboard.component').then(module => module.DashboardComponent), title: 'Your links · Shortly' },
  { path: 'insights', loadComponent: () => import('./features/insights/insights.component').then(module => module.InsightsComponent), title: 'Link insights · Shortly' },
  { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then(module => module.SettingsComponent), title: 'Workspace settings · Shortly' },
  { path: 'guide', loadComponent: () => import('./features/guide/guide.component').then(module => module.GuideComponent), title: 'Getting started · Shortly' },
  { path: '**', loadComponent: () => import('./shared/not-found/not-found.component').then(module => module.NotFoundComponent), title: 'Page not found · Shortly' }
];
