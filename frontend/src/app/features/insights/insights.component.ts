import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, normalizeError } from '../../core/errors/api-error';
import { IconComponent } from '../../shared/icons/icon.component';
import { ShortLink } from '../links/models/link.model';
import { LinksApiService } from '../links/services/links-api.service';

interface Insight { readonly link: ShortLink; readonly count: number | null; }

@Component({
  selector: 'app-insights', standalone: true, imports: [IconComponent, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-intro"><div><h1>Insights<span>.</span></h1><p>Recorded clicks for your recent links.</p></div></section>
    <section class="glass content-card" data-enter><div class="panel-title"><div><h2>Recent link activity</h2><p>Recorded clicks for your 10 most recent links.</p></div><button class="btn btn-secondary btn-small" type="button" (click)="load()" [disabled]="loading() || !auth.authenticated()"><app-icon name="refresh" />Refresh</button></div>
    <div class="info-note"><app-icon name="info" /><p>Click counts include repeat visits and bots. Background updates may take a moment. These are individual link counts, not account-wide totals.</p></div>
    @if (error(); as problem) { <div class="error-panel" role="alert">{{ problem.message }}</div> }
    @if (!auth.authenticated()) { <div class="empty-state"><div class="empty-art"><app-icon name="chart" /></div><h3>Sign in to view link statistics</h3><p>Sign in to see their recorded clicks.</p></div> }
    @else if (loading()) { <div class="empty-state" role="status"><app-icon name="refresh" class="spinning" /><p>Gathering link statistics…</p></div> }
    @else if (!rows().length && !error()) { <div class="empty-state"><h3>No link statistics yet</h3><p>Create and share a link to record clicks.</p><a routerLink="/" class="btn btn-primary">Create a link<app-icon name="arrow" /></a></div> }
    @else { <div class="insights-list">@for (row of rows(); track row.link.id) { <article><div class="icon-tile"><app-icon name="link" /></div><div class="min-w-0 flex-1"><h3>{{ row.link.code }}</h3><p class="truncate">{{ row.link.longUrl }}</p><small>Created {{ row.link.createdAt | date:'mediumDate' }}</small></div><div class="insight-count">@if (row.count !== null) { <strong>{{ row.count }}</strong> }<span>{{ row.count === null ? 'Unavailable' : 'recorded clicks' }}</span></div></article> }</div> }
    </section>
  `
})
export class InsightsComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(LinksApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly rows = signal<readonly Insight[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  private generation = 0;
  constructor() {
    effect(() => { if (this.auth.authenticated()) this.load(); else { this.generation++; this.rows.set([]); this.loading.set(false); } }, { allowSignalWrites: true });
  }
  load(): void {
    if (!this.auth.authenticated()) return;
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(null);
    this.api.list(0, 10).pipe(
      switchMap(page => page.content.length ? forkJoin(page.content.map(link => this.api.stats(link.id).pipe(
        map(stats => ({ link, count: stats.clickCount } as Insight)), catchError(() => of({ link, count: null } as Insight))
      ))) : of([] as Insight[])),
      takeUntilDestroyed(this.destroyRef), finalize(() => { if (generation === this.generation) this.loading.set(false); })
    ).subscribe({
      next: rows => { if (generation === this.generation) this.rows.set(rows); },
      error: (error: unknown) => { if (generation === this.generation) this.error.set(normalizeError(error)); }
    });
  }
}
