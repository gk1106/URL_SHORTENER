import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverRealm } from './prepare-server.mjs';

const base = { realm: 'shortener', clients: [{ clientId: 'shortener-dev', redirectUris: ['http://localhost:4200/*'], webOrigins: ['http://localhost:4200'], attributes: {} }] };
const env = {
  PUBLIC_ORIGIN: 'https://link.gkbuilds.in', ACME_EMAIL: 'test@example.invalid',
  KEYCLOAK_ADMIN_PASSWORD: 'test-admin-secret', KEYCLOAK_DB_PASSWORD: 'test-auth-db-secret',
  ORACLE_PASSWORD: 'test-oracle-secret', DB_PASSWORD: 'test-app-db-secret', REDIS_PASSWORD: 'test-cache-secret',
  SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '587', SMTP_FROM: 'test@example.invalid',
  SMTP_USERNAME: 'test-user', SMTP_PASSWORD: 'test-mail-secret', SMTP_STARTTLS: 'true', SMTP_SSL: 'false'
};
test('server realm requires verified public accounts and exact HTTPS callbacks', () => {
  const realm = serverRealm(base, env);
  assert.equal(realm.verifyEmail, true);
  assert.equal(realm.resetPasswordAllowed, true);
  assert.equal(realm.registrationAllowed, true);
  assert.deepEqual(realm.clients[0].redirectUris, ['https://link.gkbuilds.in/*']);
  assert.deepEqual(realm.clients[0].webOrigins, ['https://link.gkbuilds.in']);
  assert.equal(realm.smtpServer.starttls, 'true');
  assert.equal(realm.clients[0].clientId, 'gk-go-web');
});
test('server preparation rejects placeholder mail settings, HTTP, and unencrypted SMTP', () => {
  assert.throws(() => serverRealm(base, { ...env, SMTP_PASSWORD: 'replace-with-your-smtp-password' }));
  assert.throws(() => serverRealm(base, { ...env, PUBLIC_ORIGIN: 'http://link.gkbuilds.in' }));
  assert.throws(() => serverRealm(base, { ...env, SMTP_STARTTLS: 'false', SMTP_SSL: 'false' }));
  assert.throws(() => serverRealm(base, { ...env, SMTP_HOST: 'mailpit' }));
});
