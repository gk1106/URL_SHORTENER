import { readFile, mkdir, writeFile, chown, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

export function serverRealm(base, env) {
  const required = ['PUBLIC_ORIGIN', 'ACME_EMAIL', 'KEYCLOAK_ADMIN_PASSWORD', 'KEYCLOAK_DB_PASSWORD', 'ORACLE_PASSWORD', 'DB_PASSWORD', 'REDIS_PASSWORD', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_USERNAME', 'SMTP_PASSWORD'];
  for (const name of required) {
    if (!env[name] || /replace-with|your-provider\.example/i.test(env[name])) throw new Error(`Set ${name} in .env.server before preparing the server configuration.`);
  }
  const origin = new URL(env['PUBLIC_ORIGIN']);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('PUBLIC_ORIGIN must be an HTTPS origin, such as https://link.gkbuilds.in.');
  if (['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Use the public server hostname in PUBLIC_ORIGIN.');
  if (env['SMTP_HOST'] === 'mailpit') throw new Error('The local test mailbox cannot deliver verification emails to public users.');
  if (!(Number(env['SMTP_PORT']) > 0 && Number(env['SMTP_PORT']) < 65536)) throw new Error('SMTP_PORT must be a valid TCP port.');
  const ssl = env['SMTP_SSL'] === 'true';
  const starttls = env['SMTP_STARTTLS'] !== 'false';
  if (!ssl && !starttls) throw new Error('Server SMTP must use TLS or STARTTLS.');
  const client = structuredClone(base.clients[0]);
  client.clientId = 'gk-go-web';
  client.name = 'GK GO';
  client.redirectUris = [origin.origin + '/*'];
  client.webOrigins = [origin.origin];
  client.fullScopeAllowed = false;
  client.attributes['oauth2.device.authorization.grant.enabled'] = 'false';
  return {
    ...base, displayName: 'GK GO', sslRequired: 'all', registrationAllowed: true,
    verifyEmail: true, resetPasswordAllowed: true,
    smtpServer: {
      host: env['SMTP_HOST'], port: env['SMTP_PORT'], from: env['SMTP_FROM'],
      fromDisplayName: env['SMTP_FROM_NAME'] || 'GK GO', auth: 'true',
      user: env['SMTP_USERNAME'], password: env['SMTP_PASSWORD'], ssl: String(ssl), starttls: String(starttls)
    }, clients: [client]
  };
}

async function main() {
  if (process.getuid && ![0, 1000].includes(process.getuid())) {
    throw new Error('Run preparation in the documented Docker helper so Keycloak user 1000 can read its private import file.');
  }
  const base = JSON.parse(await readFile(resolve(root, 'infra/keycloak/shortener-realm.json'), 'utf8'));
  const realm = serverRealm(base, process.env);
  const directory = resolve(root, '.local/server');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'shortener-realm.json'), JSON.stringify(realm, null, 2) + '\n', { mode: 0o600 });
  if (process.getuid) {
    if (process.getuid() === 0) await chown(resolve(directory, 'shortener-realm.json'), 1000, 0);
    await chmod(resolve(directory, 'shortener-realm.json'), 0o600);
  }
  // The Keycloak container reads this isolated import directory; SMTP secrets remain untracked.
  console.log('Prepared .local/server/shortener-realm.json. It contains SMTP credentials; keep it private.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
