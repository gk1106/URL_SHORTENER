import { describe, expect, it } from 'vitest';
import { isApiUrl, validateConfig } from './app-config';

describe('runtime configuration and API boundary', () => {
  it('matches only the configured origin and path boundary', () => {
    const base = 'https://api.example.com/api/v1';
    expect(isApiUrl('https://api.example.com/api/v1/urls', base)).toBe(true);
    expect(isApiUrl('https://api.example.com/api/v10/urls', base)).toBe(false);
    expect(isApiUrl('https://api.example.com.evil.test/api/v1/urls', base)).toBe(false);
    expect(isApiUrl('https://evil.test/api/v1/urls', base)).toBe(false);
  });
  it('accepts relative API paths and rejects unsafe configurations', () => {
    const oidc = { url: 'http://localhost:8180', realm: 'shortener', clientId: 'shortener-dev' };
    expect(validateConfig({ apiBaseUrl: '/api/v1/', oidc }).apiBaseUrl).toBe('/api/v1');
    expect(() => validateConfig({ apiBaseUrl: 'javascript:alert(1)', oidc })).toThrow();
    expect(() => validateConfig({ apiBaseUrl: '/api/v1' })).toThrow();
  });
});
