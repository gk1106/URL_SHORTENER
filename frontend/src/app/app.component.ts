import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { normalizeError } from './core/errors/api-error';
import { IconComponent } from './shared/icons/icon.component';
import { ToastService } from './shared/toast/toast.service';

@Component({
  selector: 'app-root', standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.component.html', changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly currentYear = new Date().getFullYear();
  readonly auth = inject(AuthService);
  readonly toast = inject(ToastService);
  readonly mobileMenu = signal(false);
  readonly authBusy = signal(false);
  constructor() { void this.auth.initialize(); }

  async signIn(): Promise<void> {
    if (this.authBusy()) return;
    this.authBusy.set(true);
    try { await this.auth.login(); }
    catch (error) { this.toast.show(normalizeError(error).message, 'error'); }
    finally { this.authBusy.set(false); }
  }

  async signOut(): Promise<void> {
    if (this.authBusy()) return;
    this.authBusy.set(true);
    try { await this.auth.logout(); }
    catch { this.toast.show('Sign-out could not be completed. Please try again.', 'error'); }
    finally { this.authBusy.set(false); }
  }
}
