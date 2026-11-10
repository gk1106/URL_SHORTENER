import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../config/app-config';
import { AuthService } from '../auth/auth.service';
import { apiInterceptor } from './api.interceptor';

describe('API interceptor', () => {
  const auth = { authenticated: vi.fn(() => true), accessToken: vi.fn(), expireSession: vi.fn() };
  beforeEach(() => {
    auth.authenticated.mockReturnValue(true);
    auth.accessToken.mockReset().mockResolvedValue('test-access-token');
    auth.expireSession.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      { provide: AuthService, useValue: auth }
    ] });
  });
  it('attaches the bearer token to API requests', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/urls'));
    await Promise.resolve();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/urls');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    request.flush({ content: [] }); await result;
    TestBed.inject(HttpTestingController).verify();
  });
  it('allows anonymous creation with the browser cookie without requesting a token', async () => {
    auth.authenticated.mockReturnValue(false);
    const result = firstValueFrom(TestBed.inject(HttpClient).post('/api/v1/urls', { longUrl: 'https://example.com' }));
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/urls');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.withCredentials).toBe(true);
    expect(auth.accessToken).not.toHaveBeenCalled();
    request.flush({}); await result;
  });
  it('never sends tokens to unrelated origins', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).get('https://other.test/api/v1/urls'));
    const request = TestBed.inject(HttpTestingController).expectOne('https://other.test/api/v1/urls');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(auth.accessToken).not.toHaveBeenCalled();
    request.flush({}); await result;
  });
  it('invalidates expired sessions and returns an actionable error', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/urls'));
    const assertion = expect(result).rejects.toMatchObject({ status: 401 });
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/urls').flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
    expect(auth.expireSession).toHaveBeenCalledOnce();
  });
  it('does not automatically retry creation requests', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).post('/api/v1/urls', { longUrl: 'https://example.com' }));
    const assertion = expect(result).rejects.toMatchObject({ status: 503 });
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/urls').flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion; TestBed.inject(HttpTestingController).verify();
    expect(auth.accessToken).toHaveBeenCalledOnce();
  });
});
