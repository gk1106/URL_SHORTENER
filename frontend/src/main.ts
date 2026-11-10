import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ErrorHandler } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { APP_CONFIG, validateConfig } from './app/core/config/app-config';
import { GlobalErrorHandler } from './app/core/errors/global-error-handler';
import { apiInterceptor } from './app/core/http/api.interceptor';

async function start(): Promise<void> {
  const response = await fetch('/assets/config.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Configuration could not be loaded.');
  const config = validateConfig(await response.json());
  await bootstrapApplication(AppComponent, { providers: [
    { provide: APP_CONFIG, useValue: config },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideHttpClient(withInterceptors([apiInterceptor])),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))
  ] });
}

void start().catch(() => {
  const root = document.querySelector('app-root');
  if (!root) return;
  const heading = document.createElement('h1');
  heading.textContent = 'We couldn’t start your workspace.';
  const description = document.createElement('p');
  description.textContent = 'The application configuration could not be loaded. Refresh to retry, or contact your administrator.';
  const button = document.createElement('button');
  button.textContent = 'Reload workspace'; button.className = 'btn btn-primary';
  button.addEventListener('click', () => location.reload());
  const container = document.createElement('main'); container.className = 'startup-error';
  container.append(heading, description, button); root.replaceChildren(container);
});
