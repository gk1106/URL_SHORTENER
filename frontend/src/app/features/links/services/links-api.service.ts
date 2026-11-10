import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../../../core/config/app-config';
import { CreateLinkRequest, LinkStats, PageResponse, ShortLink, UpdateLinkRequest } from '../models/link.model';

@Injectable({ providedIn: 'root' })
export class LinksApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(APP_CONFIG).apiBaseUrl + '/urls';
  list(page = 0, size = 10) {
    return this.http.get<PageResponse<ShortLink>>(this.endpoint, { params: new HttpParams().set('page', page).set('size', size) });
  }
  create(request: CreateLinkRequest) { return this.http.post<ShortLink>(this.endpoint, request); }
  update(id: string, request: UpdateLinkRequest) { return this.http.patch<ShortLink>(`${this.endpoint}/${encodeURIComponent(id)}`, request); }
  stats(id: string) { return this.http.get<LinkStats>(`${this.endpoint}/${encodeURIComponent(id)}/stats`); }
}
