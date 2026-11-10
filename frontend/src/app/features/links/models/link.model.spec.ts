import { describe, expect, it } from 'vitest';
import { ShortLink, linkStatus } from './link.model';

const link: ShortLink = { id: 'id', code: 'code', shortUrl: 'https://short.test/r/code', longUrl: 'https://example.com', active: true, expiresAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
describe('link status', () => {
  it('distinguishes active, paused and expired links', () => {
    expect(linkStatus(link)).toBe('active');
    expect(linkStatus({ ...link, active: false })).toBe('paused');
    expect(linkStatus({ ...link, expiresAt: '2020-01-01T00:00:00Z' })).toBe('expired');
    expect(linkStatus({ ...link, active: false, expiresAt: '2020-01-01T00:00:00Z' })).toBe('expired');
  });
});
