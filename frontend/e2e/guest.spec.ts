import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test('guest allowance survives reload, blocks link 31, and transfers links after sign-in', async ({ page }) => {
  const { configureLocalAuth } = await import('../../scripts/setup-local-auth.mjs');
  const { admin } = await configureLocalAuth();
  const username = `guest-e2e-${randomBytes(8).toString('hex')}`;
  const password = randomBytes(24).toString('base64url');
  const response = await admin('users', 'POST', { username, firstName: 'Guest', lastName: 'Test',
    email: `${username}@example.invalid`, enabled: true, emailVerified: true, requiredActions: [],
    credentials: [{ type: 'password', value: password, temporary: false }] });
  const id = response.headers.get('location')!.split('/').pop()!;
  try {
    await page.goto('/');
    await expect(page.getByText('30 of 30 free links remaining', { exact: false })).toBeVisible();
    await page.getByLabel('Destination URL', { exact: true }).fill('https://example.com/guest');
    await page.getByRole('button', { name: 'Shorten link', exact: true }).click();
    await expect(page.getByText('Short link created', { exact: true })).toBeVisible();
    await expect(page.getByText('29 of 30 free links remaining', { exact: false })).toBeVisible();
    for (let index = 1; index < 30; index++) {
      const created = await page.request.post('/api/v1/urls', { data: { longUrl: 'https://example.com/guest' } });
      expect(created.status()).toBe(201);
    }
    await page.reload();
    await expect(page.getByText('0 of 30 free links remaining', { exact: false })).toBeVisible();
    const denied = await page.request.post('/api/v1/urls', { data: { longUrl: 'https://example.com/denied' } });
    expect(denied.status()).toBe(401);
    expect((await denied.json()).code).toBe('GUEST_LIMIT_REACHED');
    await page.getByRole('button', { name: 'Sign in to continue', exact: true }).click();
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
    await expect(page.getByRole('link', { name: 'Account: Guest Test', exact: true })).toBeVisible();
    await expect(page.locator('.count-badge')).toHaveText('30');
    await page.getByLabel('Destination URL', { exact: true }).fill('https://example.com/account');
    await page.getByRole('button', { name: 'Shorten link', exact: true }).click();
    await expect(page.getByText('Short link created', { exact: true })).toBeVisible();
    await expect(page.locator('.count-badge')).toHaveText('31');
  } finally { await admin(`users/${id}`, 'DELETE'); }
});
