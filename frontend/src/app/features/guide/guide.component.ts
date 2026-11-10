import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icons/icon.component';

@Component({
  selector: 'app-guide', standalone: true, imports: [RouterLink, IconComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-intro"><div><h1>Help<span>.</span></h1><p>Create a short link, share it, and manage its availability.</p></div></section>
    <section class="guide-grid" data-enter>@for (step of steps; track step.number) { <article class="glass content-card"><span class="step-number">{{ step.number }}</span><h2>{{ step.title }}</h2><p class="section-description">{{ step.body }}</p></article> }</section>
    <section class="glass content-card mt-6"><h2>Frequently asked questions</h2><div class="guide-faq"><details><summary>What makes a valid destination?</summary><p>Use a full http:// or https:// URL, without usernames or passwords in it. Destinations can contain up to 2,048 characters.</p></details><details><summary>Can I pick my own short code?</summary><p>Yes. Open Custom alias & expiration and enter an alias of 4–32 letters, digits, dashes, or underscores. Aliases are case-sensitive and must be available.</p></details><details><summary>What happens when I pause a link?</summary><p>Visitors stop being redirected immediately. You can resume a paused link, unless it has expired. Expired links cannot be resumed from this workspace.</p></details><details><summary>What do the click counts mean?</summary><p>They count recorded redirect requests, including repeat visitors and bots. Background processing means they may update a little later. They are best-effort statistics rather than exact billing or unique visitor counts.</p></details><details><summary>Why can’t I sign in?</summary><p>Your identity provider may be unavailable, or your administrator may need to create your account. Try Reconnect, then Sign in. If the problem continues, contact your administrator.</p></details></div><a routerLink="/" class="btn btn-primary mt-6">Create a link<app-icon name="arrow" /></a></section>
  `
})
export class GuideComponent {
  readonly steps = [
    { number: '01', title: 'Enter a destination', body: 'Sign in, then paste the full http:// or https:// URL you want to shorten.' },
    { number: '02', title: 'Choose an alias and expiration', body: 'Optionally enter a custom alias or future expiration date. Otherwise, the server generates a short code without an expiration.' },
    { number: '03', title: 'Copy and manage the link', body: 'Copy the short URL to share it. Use the link list to pause or resume it, and open its details to view recorded clicks.' }
  ];
}
