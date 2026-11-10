import { test, expect, Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

type Admin = (path: string, method?: string, body?: unknown) => Promise<Response>;
interface TestAccount { id: string; username: string; password: string; }
let admin: Admin;
let accounts: TestAccount[] = [];

test.beforeAll(async () => {
  const { configureLocalAuth } = await import('../../scripts/setup-local-auth.mjs');
  ({ admin } = await configureLocalAuth());
  for (let index = 0; index < 2; index++) {
    const username = `e2e-${randomBytes(8).toString('hex')}`;
    const password = randomBytes(24).toString('base64url');
    const created = await admin('users', 'POST', { username, firstName: 'E2E', lastName: 'Account', email: `${username}@example.invalid`, enabled: true, emailVerified: true, requiredActions: [], credentials: [{ type: 'password', value: password, temporary: false }] });
    const id = created.headers.get('location')!.split('/').pop()!;
    accounts.push({ id, username, password });
  }
});

test.afterAll(async () => {
  for (const account of accounts) await admin(`users/${account.id}`, 'DELETE');
  accounts = [];
});

async function signIn(page: Page, account: TestAccount) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('link', { name: 'Account: E2E Account', exact: true })).toBeVisible();
}

for (const button of ['Sign in']) {
  test(`${button} opens the identity provider from this app origin`, async ({ page, baseURL }) => {
    await page.goto('/');
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.locator('#username')).toBeVisible();
    const authorization = new URL(page.url());
    expect(authorization.searchParams.get('redirect_uri')).toBe(new URL('/', baseURL).href);
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
  });
}

test('real PKCE login, link lifecycle, ownership, reload, and logout', async ({ page, browser, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page, accounts[0]);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Account: E2E Account', exact: true })).toBeVisible();

  const alias = `e2e-${randomBytes(6).toString('hex')}`;
  await page.getByLabel('Destination URL', { exact: true }).fill('https://example.com/login-verification');
  await page.getByRole('button', { name: 'Custom alias & expiration' }).click();
  await page.getByLabel('Custom alias', { exact: true }).fill(alias);
  const creation = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/urls');
  await page.getByRole('button', { name: 'Shorten link', exact: true }).click();
  const response = await creation;
  expect(response.status()).toBe(201);
  const link = await response.json();
  await expect(page.getByText('Short link created', { exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: alias });
  await expect(row).toBeVisible();
  const redirect = await page.request.get(link.shortUrl, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()['location']).toBe('https://example.com/login-verification');

  await page.getByRole('button', { name: `Details and statistics for ${alias}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(async () => {
    await page.getByRole('button', { name: 'Refresh statistics', exact: true }).click();
    await expect(page.locator('.detail-stat strong')).toHaveText('1');
  }).toPass({ timeout: 10000 });
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.getByRole('button', { name: `Pause ${alias}`, exact: true }).click();
  await expect(row.getByText('paused', { exact: true })).toBeVisible();
  expect((await page.request.get(link.shortUrl, { maxRedirects: 0 })).status()).toBe(410);
  await page.getByRole('button', { name: `Resume ${alias}`, exact: true }).click();
  await expect(row.getByText('active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Pause ${alias}`, exact: true }).click();
  await expect(row.getByText('paused', { exact: true })).toBeVisible();

  const isolated = await browser.newContext({ baseURL });
  try {
    const secondPage = await isolated.newPage();
    let authorization = '';
    secondPage.on('request', request => {
      if (new URL(request.url()).pathname === '/api/v1/urls') authorization = request.headers()['authorization'] || '';
    });
    await signIn(secondPage, accounts[1]);
    await expect(secondPage.getByRole('heading', { name: 'No links yet', exact: true })).toBeVisible();
    expect(authorization.startsWith('Bearer ')).toBe(true);
    const denied = await isolated.request.get(`${baseURL}/api/v1/urls/${link.id}`, { headers: { Authorization: authorization } });
    expect(denied.status()).toBe(404);
  } finally { await isolated.close(); }

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No links yet', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('incorrect credentials stay on the identity provider login page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('#username').fill(accounts[0].username);
  await page.locator('#password').fill('intentionally-incorrect-test-password');
  await page.locator('#kc-login').click();
  await expect(page.getByText('Invalid username or password.', { exact: true })).toBeVisible();
  await expect(page.locator('#username')).toBeVisible();
});

test('signed-out desktop and mobile layouts remain usable', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Destination URL', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`signed-out-${viewport.width}.png`), fullPage: true });
  }
});
