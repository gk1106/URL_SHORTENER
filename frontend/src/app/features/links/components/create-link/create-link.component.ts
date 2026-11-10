import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Output, inject, signal } from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError, normalizeError } from '../../../../core/errors/api-error';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { ToastService } from '../../../../shared/toast/toast.service';
import { destinationValidator, futureDateValidator } from '../../../../shared/validators/link.validators';
import { ShortLink } from '../../models/link.model';
import { LinksApiService } from '../../services/links-api.service';

@Component({
  selector: 'app-create-link', standalone: true, imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './create-link.component.html', changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateLinkComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(LinksApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  @Output() readonly created = new EventEmitter<ShortLink>();
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly result = signal<ShortLink | null>(null);
  readonly advanced = signal(false);
  readonly form = this.fb.group({
    longUrl: ['', [Validators.required, Validators.maxLength(2048), destinationValidator]],
    alias: ['', [Validators.pattern(/^[A-Za-z0-9_-]{4,32}$/)]],
    expiresAt: ['', [futureDateValidator]]
  });

  async submit(): Promise<void> {
    if (this.busy() || this.auth.state() === 'loading') return;
    if (!this.auth.authenticated()) {
      try { await this.auth.login(); } catch (error) { this.error.set(normalizeError(error)); }
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) { if (this.form.controls.alias.invalid || this.form.controls.expiresAt.invalid) this.advanced.set(true); return; }
    this.busy.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.api.create({
      longUrl: value.longUrl,
      ...(value.alias ? { alias: value.alias } : {}),
      ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt).toISOString() } : {})
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: link => { this.result.set(link); this.form.reset(); this.created.emit(link); this.toast.show('Your new link is ready to share.'); },
      error: (error: unknown) => this.error.set(normalizeError(error))
    });
  }

  async copyResult(): Promise<void> {
    const result = this.result();
    if (!result) return;
    try { await navigator.clipboard.writeText(result.shortUrl); this.toast.show('Link copied to clipboard.'); }
    catch { this.toast.show('Clipboard access is unavailable. Select and copy the link manually.', 'error'); }
  }
}
