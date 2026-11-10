import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

async function localEnvironment() {
  const contents = await readFile(resolve(root, '.env'), 'utf8');
  const values = Object.fromEntries(contents.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  return { ...values, ...process.env };
}

/** Local-only administration. Credentials and tokens are never printed. */
export async function configureLocalAuth({ createUser = false } = {}) {
  const env = await localEnvironment();
  const issuer = env['LOCAL_OIDC_URL'] || 'http://localhost:8180';
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(issuer).hostname)) {
    throw new Error('This setup command is restricted to a local identity provider.');
  }
  const realm = JSON.parse(await readFile(resolve(root, 'infra/keycloak/shortener-realm.json'), 'utf8'));
  const desired = realm.clients[0];
  const adminToken = async () => {
    const response = await fetch(`${issuer}/realms/master/protocol/openid-connect/token`, {
      method: 'POST', body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: env['KEYCLOAK_ADMIN_PASSWORD'] }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Local identity-provider administration failed (${response.status}). Check .env credentials.`);
    return (await response.json()).access_token;
  };
  let token = await adminToken();
  const admin = async (path, method = 'GET', body) => {
    const send = () => fetch(`${issuer}/admin/realms/shortener${path ? '/' + path : ''}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    let result = await send();
    if (result.status === 401) { token = await adminToken(); result = await send(); }
    if (!result.ok) throw new Error(`Local identity-provider configuration failed (${result.status}).`);
    return result;
  };

  const currentRealm = await (await admin('')).json();
  const { clients: _clients, ...realmSettings } = realm;
  await admin('', 'PUT', { ...currentRealm, ...realmSettings });

  const clients = await (await admin(`clients?clientId=${encodeURIComponent(desired.clientId)}`)).json();
  if (clients.length !== 1) throw new Error('Expected the imported shortener-dev client. Check the shortener realm import.');
  const existing = clients[0];
  await admin(`clients/${existing.id}`, 'PUT', {
    ...existing,
    redirectUris: [...new Set([...(existing.redirectUris || []), ...desired.redirectUris])],
    webOrigins: [...new Set([...(existing.webOrigins || []), ...desired.webOrigins])],
    attributes: { ...existing.attributes, ...desired.attributes },
    protocolMappers: [...(existing.protocolMappers || []).filter(mapper => !desired.protocolMappers.some(required => required.name === mapper.name)), ...desired.protocolMappers]
  });

  if (createUser) {
    const username = 'shortly-local';
    const users = await (await admin(`users?username=${username}&exact=true`)).json();
    const destination = resolve(root, '.local/login.json');
    if (users.length === 0) {
      const password = randomBytes(24).toString('base64url');
      await admin('users', 'POST', { username, firstName: 'Local', lastName: 'Developer', email: 'shortly-local@example.invalid', enabled: true, emailVerified: true, requiredActions: [], credentials: [{ type: 'password', value: password, temporary: false }] });
      await mkdir(resolve(root, '.local'), { recursive: true });
      await writeFile(destination, JSON.stringify({ url: 'http://localhost:5173', username, password }, null, 2) + '\n', { mode: 0o600 });
      console.log('Created local application account. Credentials are in ignored .local/login.json.');
    } else {
      const user = users[0];
      if (!user.firstName || !user.lastName || !user.email) {
        await admin(`users/${user.id}`, 'PUT', { ...user,
          firstName: user.firstName || 'Local', lastName: user.lastName || 'Developer',
          email: user.email || 'shortly-local@example.invalid'
        });
      }
      console.log('Existing shortly-local account preserved. Its password was not changed.');
    }
  }
  return { admin, issuer };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  configureLocalAuth({ createUser: process.argv.includes('--create-user') })
    .then(() => console.log('Local login client configured: PKCE, API audience, and logout redirects.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
