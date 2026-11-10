import { map } from 'rxjs';
import { GuestService } from '../../../core/guest/guest.service';
import { AuthService } from '../../../core/auth/auth.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../../../core/config/app-config';
import { CreateLinkRequest, LinkStats, PageResponse, ShortLink, UpdateLinkRequest } from '../models/link.model';

@Injectable({ providedIn: 'root' })
export class LinksApiService {
  private readonly guests = inject(GuestService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(APP_CONFIG).apiBaseUrl + '/urls';
  list(page = 0, size = 10) {
    return this.http.get<PageResponse<ShortLink>>(this.auth.authenticated() ? this.endpoint : this.endpoint.replace(/\/urls$/, '/guest/links'), { params: new HttpParams().set('page', page).set('size', size) });
  }
  create(request: CreateLinkRequest) { return this.http.post<ShortLink>(this.endpoint, request, { observe: 'response' }).pipe(map(response => {
    const remaining = response.headers.get('X-Guest-Remaining');
    if (remaining !== null) this.guests.setRemaining(Number(remaining));
    return response.body!;
  })); }
  update(id: string, request: UpdateLinkRequest) { return this.http.patch<ShortLink>(`${this.endpoint}/${encodeURIComponent(id)}`, request); }
  stats(id: string) { return this.http.get<LinkStats>(`${this.endpoint}/${encodeURIComponent(id)}/stats`); }
}
