import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiError, normalizeError } from './api-error';

describe('API error normalization', () => {
  it('uses safe messages and preserves request IDs', () => {
    const error = normalizeError(new HttpErrorResponse({ status: 500, error: { detail: 'SQL password=secret', requestId: 'request-1' } }));
    expect(error.message).not.toContain('SQL');
    expect(error.requestId).toBe('request-1');
  });
  it('preserves retry information without retrying automatically', () => {
    const error = normalizeError(new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '60', 'X-Request-ID': 'trace-2' }) }));
    expect(error.retryAfter).toBe('60');
    expect(error.requestId).toBe('trace-2');
    expect(error.message).toContain('too many requests');
  });
  it('turns HTML and network failures into useful text', () => {
    expect(normalizeError(new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' })).message).not.toContain('<html>');
    expect(normalizeError(new HttpErrorResponse({ status: 0 })).message).toContain('connection');
  });
  it('does not wrap normalized errors again', () => {
    const error = new ApiError('Already handled', 409);
    expect(normalizeError(error)).toBe(error);
  });
});
