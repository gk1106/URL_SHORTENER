import { HttpErrorResponse } from '@angular/common/http';

export class ApiError extends Error {
  constructor(message: string, readonly status = 0, readonly requestId?: string, readonly retryAfter?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
  }
  const body: unknown = error.error;
  const problem = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
  const requestId = typeof problem['requestId'] === 'string' ? problem['requestId'] : error.headers.get('X-Request-ID') ?? undefined;
  const messages: Record<number, string> = {
    0: 'We could not reach the server. Check your connection and try again.',
    400: 'Check the URL, alias, and expiration date, then try again.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'This link could not be found. It may no longer be available.',
    409: 'This alias is already taken, or the link changed. Refresh and try again.',
    410: 'This link is inactive or has expired.',
    413: 'This request is too large. Try a shorter destination URL.',
    429: 'You have made too many requests. Wait a moment and try again.',
    503: 'The service is temporarily unavailable. Please try again shortly.'
  };
  // Never display arbitrary proxy HTML, database errors, or upstream exception messages.
  return new ApiError(messages[error.status] ?? 'The server could not complete your request. Please try again.',
    error.status, requestId, error.headers.get('Retry-After') ?? undefined);
}
