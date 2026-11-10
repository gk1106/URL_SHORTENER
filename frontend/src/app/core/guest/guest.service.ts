import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';
import { AuthService } from '../auth/auth.service';
import { normalizeError } from '../errors/api-error';

interface Allowance { limit: number; used: number; remaining: number; }
@Injectable({ providedIn: 'root' })
export class GuestService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_CONFIG).apiBaseUrl + '/guest';
  private readonly auth = inject(AuthService);
  readonly allowance = signal<Allowance | null>(null);
  readonly error = signal('');
  readonly accountReady = signal(false);
  readonly ready = computed(() => this.auth.authenticated() ? this.accountReady() : this.allowance() !== null);
  constructor() {
    effect(() => {
      if (this.auth.authenticated()) {
        this.accountReady.set(false);
        this.http.post<void>(this.base + '/claim', {}).subscribe({
          next: () => this.accountReady.set(true),
          error: error => this.error.set(normalizeError(error).message)
        });
      } else { this.accountReady.set(false); this.refresh(); }
    }, { allowSignalWrites: true });
  }
  private refreshing = false;
  refresh(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.error.set('');
    this.http.get<Allowance>(this.base + '/session').pipe(finalize(() => { this.refreshing = false; })).subscribe({
      next: value => this.allowance.set(value), error: error => this.error.set(normalizeError(error).message)
    });
  }
  setRemaining(remaining: number): void {
    this.allowance.update(value => value ? { ...value, remaining, used: value.limit - remaining } : value);
  }
  retry(): void { if (this.auth.authenticated()) location.reload(); else this.refresh(); }
}
