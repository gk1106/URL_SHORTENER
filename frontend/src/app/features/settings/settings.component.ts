import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { IconComponent } from '../../shared/icons/icon.component';

@Component({
  selector: 'app-settings', standalone: true, imports: [IconComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-intro"><div><h1>Settings<span>.</span></h1><p>Your profile and service configuration.</p></div></section>
    <div class="settings-grid" data-enter><section class="glass content-card"><span class="icon-tile"><app-icon name="shield" /></span><h2 class="mt-5">Your account</h2><p class="section-description">Sign-in is managed securely by your identity provider.</p><dl class="detail-list"><dt>Name</dt><dd>{{ auth.authenticated() ? auth.displayName() : 'Not signed in' }}</dd><dt>Username</dt><dd>{{ auth.username() || 'Not signed in' }}</dd><dt>Session</dt><dd>{{ auth.state() }}</dd><dt>Workspace access</dt><dd>Only your own links are available to this account.</dd></dl></section>
    <section class="glass content-card"><span class="icon-tile"><app-icon name="globe" /></span><h2 class="mt-5">Service connections</h2><p class="section-description">Deployment settings are configured by your administrator.</p><dl class="detail-list"><dt>API</dt><dd>{{ config.apiBaseUrl }}</dd><dt>Sign-in provider</dt><dd>{{ config.oidc.url }}</dd><dt>Realm</dt><dd>{{ config.oidc.realm }}</dd><dt>Client</dt><dd>{{ config.oidc.clientId }}</dd></dl></section></div>
    <div class="info-note mt-6"><app-icon name="info" /><p>Access tokens stay in memory and are sent only to the configured API. Passwords are entered with your identity provider, not in this workspace.</p></div>
  `
})
export class SettingsComponent { readonly auth = inject(AuthService); readonly config = inject(APP_CONFIG); }
