import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { APP_CONFIG, isApiUrl } from '../config/app-config';
import { ApiError, normalizeError } from '../errors/api-error';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);
  if (!isApiUrl(request.url, config.apiBaseUrl)) return next(request);
  const auth = inject(AuthService);
  const path = request.url.split('?')[0];
  const guestRequest = !auth.authenticated() && ((request.method === 'GET' && /\/guest\/(session|links)$/.test(path))
    || (request.method === 'POST' && /\/urls$/.test(path)));
  return (guestRequest ? of<string | null>(null) : from(auth.accessToken())).pipe(
    switchMap(token => next(request.clone({ withCredentials: true, ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}) })).pipe(timeout(15000))),
    catchError((error: unknown) => {
      const normalized = error instanceof Error && error.name === 'TimeoutError'
        ? new ApiError('This request took too long. Check your links before retrying a creation request.')
        : normalizeError(error);
      if (normalized.status === 401 && !guestRequest) auth.expireSession();
      return throwError(() => normalized);
    })
  );
};
