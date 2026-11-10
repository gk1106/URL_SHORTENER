import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-not-found', standalone: true, imports: [RouterLink], changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<section class="page-intro"><h1>Not found<span>.</span></h1><p>This page does not exist. Check the address or return to your links.</p><a routerLink="/" class="btn btn-primary mt-6">Back to your links</a></section>'
})
export class NotFoundComponent {}
