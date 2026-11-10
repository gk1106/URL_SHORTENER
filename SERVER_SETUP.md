# GK GO server authentication

The public flow is **Sign up → verify email → set password → signed-in workspace**. Guests can create their first 30 links per browser. Sign-in is required after that and for managing links or viewing statistics. Anyone can open an active short link. Password recovery uses an emailed, expiring Keycloak action link. Passwords are stored by Keycloak, separate from the URL database.

## Verify locally

Run `./scripts/start-local.ps1` from the repository root, then open http://localhost:5173 (or your Angular development server on http://localhost:4200).

Click **Sign up**, enter a username, email, and name, then submit. The local verification email appears at **http://localhost:8025**. Open its verification link and choose a password. Keycloak's email-first registration deliberately sets the password after verification. The **Forgot password?** link on the sign-in page uses the same test mailbox.

Mailpit only captures local messages; it does not deliver email to real inboxes. Do not expose its port or use it for the public server. Existing local application accounts and passwords are preserved.

## Prepare your server

The standalone `compose.server.yml` keeps the website at **https://link.gkbuilds.in** and the identity provider under **/auth** on the same hostname. Caddy terminates HTTPS and obtains certificates. Only ports 80/443 are published. Oracle, Redis, the backend, Keycloak, and Keycloak's PostgreSQL database stay on the Docker network. Keycloak runs in server mode with PostgreSQL rather than the development file database. No local application accounts are imported.

Requirements:

- Docker Engine and Compose on a server compatible with the supplied images, with capacity for Oracle and Keycloak.
- DNS A/AAAA records for `link.gkbuilds.in` pointing to the server, with ports 80/443 reachable. Do not publish an AAAA record unless IPv6 reaches that server.
- An SMTP provider authorized to send as your chosen account address. Configure the provider's domain verification/SPF/DKIM settings and use its TLS/STARTTLS credentials.
- A supported Angular/Node maintenance baseline before public launch. The requested Angular 17 version still has the previously identified runtime advisories; these hosting files do not resolve them.

On the server, copy `.env.server.example` to `.env.server`, replace all password placeholders, and configure SMTP. Restrict that file's permissions:

```sh
cp .env.server.example .env.server
chmod 600 .env.server
# Edit .env.server locally. Do not commit or share it.
```

Render the private realm import with the Docker helper. This validates HTTPS, SMTP encryption, and required settings, and sets file ownership so the Keycloak container can read it:

```sh
docker run --rm --user 0 \
  --env-file .env.server \
  -v "$PWD:/workspace" -w /workspace \
  node:20.19.0-bookworm-slim node scripts/prepare-server.mjs

docker compose --env-file .env.server -f compose.server.yml config --quiet
docker compose --env-file .env.server -f compose.server.yml up --build -d
```

The rendered `.local/server/shortener-realm.json` contains the SMTP secret and is ignored by Git. Keep it private. It allows only your HTTPS hostname for the public client and requires verified email. The browser receives public runtime settings only; it receives no SMTP or database credentials.

Wait for Oracle and Keycloak to finish initialization, then check registration, email delivery, sign-in, logout, and a real short-link redirect on the public hostname. The public stack is separate from local Compose volumes; it does not migrate local users or links. Back up the Oracle and Keycloak PostgreSQL volumes and Caddy certificate data, and test restoration.

Keycloak's public admin/master paths are blocked by Caddy. Manage it over SSH using the container's `kcadm.sh` CLI. Avoid passwords in shell arguments; use its interactive password prompt. For example:

```sh
docker compose --env-file .env.server -f compose.server.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080/auth --realm master --user gkgo-admin
```

Create a permanent administrator and retire the bootstrap administrator as part of server setup. Realm imports apply only on the first startup of a new realm. Later SMTP, hostname, policy, or client changes must be applied through the administrator API/CLI; changing the import file does not overwrite an existing realm or reset its users.

Keep registration/login endpoints monitored and apply ingress abuse limits appropriate to your deployment. Keycloak brute-force protection is enabled; API rate limiting remains enforced by the backend. HTTPS and working SMTP must be checked on your actual server before announcing public registration.

## Automated checks

```sh
node --test scripts/prepare-server.test.mjs
cd frontend
npm test
npm run build
npm run test:e2e
```

Browser tests use disposable accounts and the local Mailpit inbox. They cover signup, verification, password setup, authenticated creation, ownership isolation, recovery, and sign-in with the recovered password. They do not deliver messages to real addresses or deploy to your server.

References: [Keycloak registration and recovery](https://www.keycloak.org/docs/26.7.0/server_admin/index.html), [Keycloak production configuration](https://www.keycloak.org/server/configuration-production), [Keycloak reverse proxies](https://www.keycloak.org/server/reverseproxy), and [Mailpit local email capture](https://mailpit.axllent.org/docs/install/docker/).

### Anonymous link allowance

Anonymous browsers can create 30 successful links in total before sign-in is required. The backend persists the counter in Oracle and locks it during creation, including concurrent requests. Invalid requests and alias conflicts do not consume an allowance. The HttpOnly `gkgo_visitor` cookie identifies the browser; clearing it or using another browser starts a new allowance, so this is not a per-person identity limit. IP rate limits still apply. Guest links are transferred to the signed-in account on login. Guest users can list/copy their links; editing and statistics require an account.

Production guest cookies are Secure and require HTTPS. Only local HTTP development sets `GUEST_COOKIE_SECURE=false`. Keep the API on the same origin as the frontend where possible.
