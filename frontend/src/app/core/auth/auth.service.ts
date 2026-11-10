import { Injectable, computed, inject, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { APP_CONFIG } from '../config/app-config';

type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(APP_CONFIG);
  private client = this.createClient();
  private initialization: Promise<void> | undefined;
  readonly state = signal<AuthState>('loading');
  readonly displayName = signal('Your workspace');
  readonly username = signal('');
  readonly authenticated = computed(() => this.state() === 'authenticated');
  readonly initials = computed(() => this.displayName().split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase());

  initialize(): Promise<void> {
    return this.initialization ??= this.initializeClient();
  }

  async retry(): Promise<void> {
    if (this.state() !== 'unavailable') return;
    this.client = this.createClient();
    this.initialization = undefined;
    this.state.set('loading');
    await this.initialize();
  }

  async login(): Promise<void> {
    if (this.state() === 'unavailable') await this.retry();
    if (this.state() === 'unavailable') throw new Error('Sign-in is temporarily unavailable. Please try again.');
    await this.initialize();
    await this.client.login({ redirectUri: location.origin + location.pathname });
  }

  async logout(): Promise<void> {
    await this.client.logout({ redirectUri: location.origin + '/' });
  }

  async accessToken(): Promise<string> {
    if (!this.authenticated()) throw new Error('Sign in to continue.');
    try {
      await this.client.updateToken(30);
      if (!this.client.token) throw new Error('Missing token');
      return this.client.token;
    } catch {
      this.client.clearToken();
      this.state.set('anonymous');
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  expireSession(): void {
    this.client.clearToken();
    this.state.set('anonymous');
  }

  private createClient(): Keycloak {
    return new Keycloak(this.config.oidc);
  }

  private async initializeClient(): Promise<void> {
    try {
      const authenticated = await this.client.init({
        onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false,
        silentCheckSsoRedirectUri: location.origin + '/assets/silent-check-sso.html',
        silentCheckSsoFallback: false, responseMode: 'query', messageReceiveTimeout: 6000
      });
      const claims = this.client.tokenParsed;
      this.displayName.set(typeof claims?.['name'] === 'string' ? claims['name'] : typeof claims?.['preferred_username'] === 'string' ? claims['preferred_username'] : 'Your workspace');
      this.username.set(typeof claims?.['preferred_username'] === 'string' ? claims['preferred_username'] : '');
      this.client.onAuthLogout = () => this.state.set('anonymous');
      this.state.set(authenticated ? 'authenticated' : 'anonymous');
    } catch {
      this.state.set('unavailable');
    }
  }
}
