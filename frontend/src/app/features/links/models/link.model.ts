export interface ShortLink {
  readonly id: string;
  readonly code: string;
  readonly shortUrl: string;
  readonly longUrl: string;
  readonly active: boolean;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateLinkRequest { readonly longUrl: string; readonly alias?: string; readonly expiresAt?: string; }
export interface UpdateLinkRequest { readonly active?: boolean; readonly expiresAt?: string; }
export interface LinkStats { readonly id: string; readonly clickCount: number; }
export interface PageResponse<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export type LinkStatus = 'active' | 'paused' | 'expired';
export function linkStatus(link: ShortLink, now = Date.now()): LinkStatus {
  if (link.expiresAt && Date.parse(link.expiresAt) <= now) return 'expired';
  return link.active ? 'active' : 'paused';
}
