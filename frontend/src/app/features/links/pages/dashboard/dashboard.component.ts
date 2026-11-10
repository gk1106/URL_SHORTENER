import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError, normalizeError } from '../../../../core/errors/api-error';
import { IconComponent } from '../../../../shared/icons/icon.component';
import { ToastService } from '../../../../shared/toast/toast.service';
import { CreateLinkComponent } from '../../components/create-link/create-link.component';
import { LinkStats, LinkStatus, PageResponse, ShortLink, linkStatus } from '../../models/link.model';
import { LinksApiService } from '../../services/links-api.service';

@Component({
  selector: 'app-dashboard', standalone: true,
  imports: [DatePipe, RouterLink, IconComponent, CreateLinkComponent], templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(LinksApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly page = signal<PageResponse<ShortLink> | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly query = signal('');
  readonly filter = signal<'all' | LinkStatus>('all');
  readonly filterOptions: readonly { value: 'all' | LinkStatus; label: string }[] = [
    { value: 'all', label: 'All links' }, { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' }, { value: 'expired', label: 'Expired' }
  ];
  @ViewChild('linkDialog') set linkDialog(element: ElementRef<HTMLDialogElement> | undefined) {
    if (element && !element.nativeElement.open) element.nativeElement.showModal();
  }
  readonly busyIds = signal<ReadonlySet<string>>(new Set());
  readonly stats = signal<ReadonlyMap<string, LinkStats>>(new Map());
  readonly selected = signal<ShortLink | null>(null);
  readonly statsLoading = signal(false);
  readonly statsError = signal<ApiError | null>(null);
  readonly status = linkStatus;
  readonly links = computed(() => this.page()?.content ?? []);
  readonly activeCount = computed(() => this.links().filter(link => linkStatus(link) === 'active').length);
  readonly expiringCount = computed(() => this.links().filter(link => linkStatus(link) === 'active' && link.expiresAt).length);
  readonly filtered = computed(() => {
    const query = this.query().toLowerCase().trim();
    return this.links().filter(link => (this.filter() === 'all' || linkStatus(link) === this.filter())
      && (!query || [link.longUrl, link.shortUrl, link.code].some(value => value.toLowerCase().includes(query))));
  });
  private generation = 0;
  private statsGeneration = 0;

  constructor() {
    effect(() => {
      if (this.auth.authenticated()) this.load(0);
      else { this.generation++; this.statsGeneration++; this.page.set(null); this.stats.set(new Map()); this.selected.set(null); this.loading.set(false); }
    }, { allowSignalWrites: true });
  }

  load(page = this.page()?.page ?? 0): void {
    if (!this.auth.authenticated()) return;
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(null);
    this.api.list(page).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (generation === this.generation) this.loading.set(false); })).subscribe({
      next: result => { if (generation === this.generation) this.page.set(result); },
      error: (error: unknown) => { if (generation === this.generation) this.error.set(normalizeError(error)); }
    });
  }

  onCreated(_link: ShortLink): void { this.query.set(''); this.filter.set('all'); this.load(0); }

  search(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.query.set(event.target.value);
  }

  toggle(link: ShortLink): void {
    if (this.busyIds().has(link.id) || linkStatus(link) === 'expired') return;
    this.setBusy(link.id, true);
    this.api.update(link.id, { active: !link.active }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.setBusy(link.id, false))).subscribe({
      next: updated => {
        this.page.update(page => page ? { ...page, content: page.content.map(item => item.id === updated.id ? updated : item) } : page);
        if (this.selected()?.id === updated.id) this.selected.set(updated);
        this.toast.show(updated.active ? 'Link is active again.' : 'Link paused. Visitors will no longer be redirected.');
      },
      error: (error: unknown) => this.toast.show(normalizeError(error).message, 'error')
    });
  }

  openStats(link: ShortLink): void {
    this.selected.set(link); this.refreshStats(link);
  }

  refreshStats(link: ShortLink): void {
    const generation = ++this.statsGeneration;
    this.statsLoading.set(true); this.statsError.set(null);
    this.api.stats(link.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (generation === this.statsGeneration) this.statsLoading.set(false); })).subscribe({
      next: stats => { if (generation === this.statsGeneration) this.stats.update(current => new Map(current).set(link.id, stats)); },
      error: (error: unknown) => { if (generation === this.statsGeneration) this.statsError.set(normalizeError(error)); }
    });
  }

  closeStats(): void { this.statsGeneration++; this.selected.set(null); this.statsLoading.set(false); }

  async copy(link: ShortLink): Promise<void> {
    try { await navigator.clipboard.writeText(link.shortUrl); this.toast.show('Link copied to clipboard.'); }
    catch { this.toast.show('Clipboard access is unavailable. Select and copy the link manually.', 'error'); }
  }

  hostname(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Destination'; } }
  displayUrl(url: string): string { return url.replace(/^https?:\/\//, ''); }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update(current => { const next = new Set(current); if (busy) next.add(id); else next.delete(id); return next; });
  }
}
