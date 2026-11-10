import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test('public signup requires email verification and supports password recovery', async ({ page, request, baseURL }) => {
  test.setTimeout(150000);
  const { configureLocalAuth } = await import('../../scripts/setup-local-auth.mjs');
  const { admin } = await configureLocalAuth();
  const username = `signup-${randomBytes(7).toString('hex')}`;
  const email = `${username}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const newPassword = randomBytes(24).toString('base64url');
  let userId: string | undefined;

  const emailLink = async (subject: RegExp): Promise<string> => {
    let link = '';
    await expect(async () => {
      const response = await request.get(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent('to:' + email)}`);
      expect(response.status()).toBe(200);
      const inbox = await response.json();
      const message = inbox.messages.find((item: { Subject: string }) => subject.test(item.Subject));
      expect(message).toBeTruthy();
      const full = await (await request.get(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
      link = (String(full.Text).match(/https?:\/\/[^\s<>"\]]+/g) || []).find(url => url.includes('/login-actions/action-token')) || '';
      expect(link).toBeTruthy();
      expect(new URL(link).hostname).toBe('localhost');
    }).toPass({ timeout: 20000 });
    return link;
  };

  try {
    // The guest-quota browser test shares the local IP rate-limit window.
    await expect(async () => {
      expect((await request.get(`${baseURL}/api/v1/urls`)).status()).toBe(401);
    }).toPass({ timeout: 65000, intervals: [2000] });
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await page.locator('#firstName').fill('Signup');
    await page.locator('#lastName').fill('Test');
    await page.locator('#email').fill(email);
    await page.locator('#username').fill(username);
    await page.locator('form button[type=submit], form input[type=submit]').click();

    await expect(async () => {
      const users = await (await admin(`users?username=${username}&exact=true`)).json();
      expect(users).toHaveLength(1);
      userId = users[0].id;
      expect(users[0].emailVerified).toBe(false);
    }).toPass({ timeout: 10000 });
    // The guest-quota browser test shares the local IP rate-limit window.
    await expect(async () => {
      expect((await request.get(`${baseURL}/api/v1/urls`)).status()).toBe(401);
    }).toPass({ timeout: 65000, intervals: [2000] });
    await page.goto(await emailLink(/verif/i));
    await page.locator('#password-new').fill(password);
    await page.locator('#password-confirm').fill(password);
    await page.locator('form button[type=submit], form input[type=submit]').click();
    await expect(page.getByRole('link', { name: 'Account: Signup Test', exact: true })).toBeVisible();
    expect((await (await admin(`users/${userId}`)).json()).emailVerified).toBe(true);

    await page.getByLabel('Destination URL', { exact: true }).fill('https://example.com/registered-user');
    const creation = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/urls');
    await page.getByRole('button', { name: 'Shorten link', exact: true }).click();
    const created = await creation;
    expect(created.status()).toBe(201);
    const link = await created.json();
    await page.getByRole('button', { name: `Pause ${link.code}`, exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: link.code }).getByText('paused', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: /forgot password/i }).click();
    await page.locator('#username').fill(email);
    await page.locator('form button[type=submit], form input[type=submit]').click();
    await page.goto(await emailLink(/reset/i));
    await page.locator('#password-new').fill(newPassword);
    await page.locator('#password-confirm').fill(newPassword);
    await page.locator('form button[type=submit], form input[type=submit]').click();
    await expect(page.getByRole('link', { name: 'Account: Signup Test', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.locator('#username').fill(email);
    await page.locator('#password').fill(newPassword);
    await page.locator('#kc-login').click();
    await expect(page.getByRole('link', { name: 'Account: Signup Test', exact: true })).toBeVisible();
  } finally {
    if (!userId) {
      const users = await (await admin(`users?username=${username}&exact=true`)).json();
      userId = users[0]?.id;
    }
    if (userId) await admin(`users/${userId}`, 'DELETE');
  }
});
