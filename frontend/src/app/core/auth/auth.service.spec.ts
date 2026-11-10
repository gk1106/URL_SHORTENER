import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../config/app-config';
import { AuthService } from './auth.service';

const adapter = vi.hoisted(() => ({
  init: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), updateToken: vi.fn(), clearToken: vi.fn(),
  token: 'access-token', tokenParsed: { name: 'Test User', preferred_username: 'test-user' },
  onAuthLogout: undefined as (() => void) | undefined
}));
vi.mock('keycloak-js', () => ({ default: vi.fn(() => adapter) }));

describe('authentication lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.init.mockResolvedValue(true);
    adapter.login.mockResolvedValue(undefined);
    adapter.register.mockResolvedValue(undefined);
    adapter.logout.mockResolvedValue(undefined);
    adapter.updateToken.mockResolvedValue(false);
    adapter.token = 'access-token';
    adapter.onAuthLogout = undefined;
    TestBed.configureTestingModule({ providers: [{ provide: APP_CONFIG, useValue: { registrationEnabled: true, oidc: { url: 'http://localhost:8180', realm: 'shortener', clientId: 'shortener-dev' } } }] });
  });

  it('initializes PKCE and reads the authenticated profile', async () => {
    const auth = TestBed.inject(AuthService);
    await Promise.all([auth.initialize(), auth.initialize()]);
    expect(adapter.init).toHaveBeenCalledOnce();
    expect(adapter.init).toHaveBeenCalledWith(expect.objectContaining({ pkceMethod: 'S256', responseMode: 'query' }));
    expect(auth.authenticated()).toBe(true);
    expect(auth.username()).toBe('test-user');
  });

  it('opens public registration with a callback to the application', async () => {
    await TestBed.inject(AuthService).register();
    expect(adapter.register).toHaveBeenCalledWith({ redirectUri: location.origin + location.pathname });
  });

  it('does not open registration when disabled by deployment configuration', async () => {
    TestBed.overrideProvider(APP_CONFIG, { useValue: { registrationEnabled: false, oidc: { url: 'http://localhost:8180', realm: 'shortener', clientId: 'shortener-dev' } } });
    await expect(TestBed.inject(AuthService).register()).rejects.toThrow('not enabled');
    expect(adapter.register).not.toHaveBeenCalled();
  });

  it('does not redirect after initialization fails', async () => {
    adapter.init.mockRejectedValue(new Error('offline'));
    const auth = TestBed.inject(AuthService);
    await expect(auth.login()).rejects.toThrow('temporarily unavailable');
    expect(adapter.login).not.toHaveBeenCalled();
    expect(auth.state()).toBe('unavailable');
  });

  it('exits the connecting state if a silent sign-in callback never completes', async () => {
    vi.useFakeTimers();
    try {
      adapter.init.mockImplementation(() => new Promise(() => {}));
      const auth = TestBed.inject(AuthService);
      const initialization = auth.initialize();
      await vi.advanceTimersByTimeAsync(15000);
      await initialization;
      expect(auth.state()).toBe('unavailable');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes tokens and clears profile information on refresh failure', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.initialize();
    expect(await auth.accessToken()).toBe('access-token');
    expect(adapter.updateToken).toHaveBeenCalledWith(30);
    adapter.updateToken.mockRejectedValue(new Error('expired'));
    await expect(auth.accessToken()).rejects.toThrow('session has expired');
    expect(auth.authenticated()).toBe(false);
    expect(auth.username()).toBe('');
    expect(adapter.clearToken).toHaveBeenCalledOnce();
  });

  it('returns logout to this application and handles provider logout', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.initialize();
    await auth.logout();
    expect(adapter.logout).toHaveBeenCalledWith({ redirectUri: location.origin + '/' });
    adapter.onAuthLogout?.();
    expect(auth.authenticated()).toBe(false);
    expect(auth.username()).toBe('');
  });
});
