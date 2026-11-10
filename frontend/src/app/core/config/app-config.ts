import { InjectionToken } from '@angular/core';

export interface AppConfig {
  readonly apiBaseUrl: string;
  readonly registrationEnabled?: boolean;
  readonly oidc: { readonly url: string; readonly realm: string; readonly clientId: string };
}

export const APP_CONFIG = new InjectionToken<AppConfig>('Application runtime configuration');

export function validateConfig(value: unknown): AppConfig {
  const config = value as Partial<AppConfig> | null;
  if (!config || typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl
      || (config.registrationEnabled !== undefined && typeof config.registrationEnabled !== 'boolean')
      || !config.oidc || typeof config.oidc.url !== 'string'
      || typeof config.oidc.realm !== 'string' || !config.oidc.realm
      || typeof config.oidc.clientId !== 'string' || !config.oidc.clientId) {
    throw new Error('The application configuration is incomplete.');
  }
  const api = new URL(config.apiBaseUrl, location.origin);
  const issuer = new URL(config.oidc.url);
  for (const url of [api, issuer]) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('The application configuration contains an invalid service URL.');
    }
    if (location.protocol === 'https:' && url.protocol !== 'https:') {
      throw new Error('Secure deployments require HTTPS service URLs.');
    }
  }
  return { apiBaseUrl: config.apiBaseUrl.replace(/\/+$/, ''), oidc: config.oidc, registrationEnabled: config.registrationEnabled === true };
}

export function isApiUrl(url: string, base: string): boolean {
  const request = new URL(url, location.origin);
  const api = new URL(base, location.origin);
  return request.origin === api.origin
    && (request.pathname === api.pathname || request.pathname.startsWith(api.pathname + '/'));
}
