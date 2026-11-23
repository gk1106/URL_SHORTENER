# GK GO server authentication

The public flow is **Sign up → verify email → set password → signed-in workspace**. Guests can create their first 30 links per browser. Sign-in is required after that and for managing links or viewing statistics. Anyone can open an active short link. Password recovery uses an emailed, expiring Keycloak action link. Passwords are stored by Keycloak, separate from the URL database.

## Verify locally

Run `./scripts/start-local.ps1` from the repository root, then open http://localhost:5173 (or your Angular development server on http://localhost:4200).

Click **Sign up**, enter a username, email, and name, then submit. The local verification email appears at **http://localhost:8025**. Open its verification link and choose a password. Keycloak's email-first registration deliberately sets the password after verification. The **Forgot password?** link on the sign-in page uses the same test mailbox.

Mailpit only captures local messages; it does not deliver email to real inboxes. Do not expose its port or use it for the public server. Existing local application accounts and passwords are preserved.

## Prepare your server

`compose.server.yml` keeps the website at **https://link.gkbuilds.in** and the identity provider under **/auth** on the same hostname. It is configured for a VPS that already hosts other projects: your existing reverse proxy retains ports 80/443 and handles certificates. This stack publishes only **127.0.0.1:18090**, configurable through `WEB_PORT`. Its private Caddy gateway routes the frontend, API, redirects, and authentication. The application PostgreSQL database, Redis, the backend, Keycloak, and Keycloak's separate PostgreSQL database stay on the project's own Docker network. Keycloak runs in server mode rather than using its development file database. No local application accounts are imported.

Use this server Compose file by itself, not combined with `compose.yml` (which publishes development ports). The project name `gk-go-server` isolates its containers, network, and volumes. Keep this name stable during updates, and ensure it is not already used by another deployment.

Before starting, inspect the VPS without stopping its existing projects:

```sh
sudo ss -ltnp
docker ps --format 'table {{.Names}}\t{{.Ports}}'
docker compose ls
free -h
df -h
```

If port 18090 is occupied, choose another unused port in `.env.server` and use the same port in your outer proxy. Internal ports such as 8080, 5432, and 6379 do not need changing because they are not published. Check available memory and disk before building: this stack runs Keycloak, two small PostgreSQL instances, Redis, and Java alongside your other applications.

Requirements:

- Docker Engine and Compose on a server compatible with the supplied images, with capacity for PostgreSQL and Keycloak.
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
docker run --rm --user 0 --memory 128m --cpus 0.25 \
  --env-file .env.server \
  -v "$PWD:/workspace" -w /workspace \
  node:20.19.0-bookworm-slim node scripts/prepare-server.mjs

docker compose --env-file .env.server -f compose.server.yml config --quiet
# Load prebuilt images and follow the staged startup below on this small VPS.
```

The rendered `.local/server/shortener-realm.json` contains the SMTP secret and is ignored by Git. Keep it private. It allows only your HTTPS hostname for the public client and requires verified email. The browser receives public runtime settings only; it receives no SMTP or database credentials.

Wait for PostgreSQL and Keycloak to finish initialization, then check registration, email delivery, sign-in, logout, and a real short-link redirect on the public hostname. The public stack is separate from local Compose volumes; it does not migrate local users or links. Back up both PostgreSQL databases and your existing proxy's certificate data, and test restoration.

This version initializes the application in a new `postgres-data` volume with `DB_PASSWORD`; `ORACLE_PASSWORD` is no longer used. It does not migrate data from an earlier Oracle installation. If you previously started Oracle for this project, stop that project's Oracle service using the old Compose file before updating; preserve its volume for export/backup. Do not remove database volumes to apply this change. The VPS folder inspected for this deployment was empty, so no server-side Oracle migration is expected.

## Resource limits for the existing 3.6 GiB VPS

The server Compose file sets hard runtime memory and CPU limits for every container. These settings do not change the Insurance AI or portfolio deployments.

| Service | RAM ceiling | RAM + swap ceiling | CPU ceiling |
| --- | --- | --- | --- |
| Application PostgreSQL | 192 MiB | 384 MiB | 0.25 core |
| Keycloak | 768 MiB | 1280 MiB | 0.50 core |
| Backend | 384 MiB | 640 MiB | 0.35 core |
| Authentication PostgreSQL | 128 MiB | 256 MiB | 0.25 core |
| Redis | 64 MiB | 96 MiB | 0.10 core |
| Private gateway | 48 MiB | 96 MiB | 0.10 core |
| Frontend | 32 MiB | 64 MiB | 0.10 core |
| Total | 1616 MiB | 2816 MiB | 1.65 cores |

These are ceilings, not reservations or expected usage. Replacing Oracle saves 1344 MiB in the runtime RAM ceiling. The reported 1.3 GiB available RAM is still less than this stack's aggregate ceiling, so retain swap as a buffer. Limits alone cannot guarantee that existing sites stay responsive: swap I/O and host memory pressure affect all projects. This is a low-traffic configuration that still needs validation on the VPS.

Keycloak's heap is capped at 384 MiB, and the backend's at 192 MiB, leaving space for native JVM allocations. Database pools and HTTP workers are reduced. Redis uses a 24 MiB dataset limit with `noeviction` so memory pressure cannot silently evict rate-limit counters; exhaustion can cause API 503 responses. Each container retains at most three 10 MB Docker log files. CPU limits are per container, not reserved CPUs.

### Add swap before starting this stack

The supplied VPS has no swap. Add a **4 GiB swap file** before attempting this configuration. Swap uses disk, not additional physical RAM, and can make requests slow under pressure. These commands target a new dedicated file; run the block only once and stop if any command fails:

```sh
(
  set -eu
  if sudo test -e /swap-shortlink; then
    echo '/swap-shortlink already exists; inspect it instead of overwriting it.'
    exit 1
  fi
  sudo install -m 600 /dev/null /swap-shortlink
  sudo dd if=/dev/zero of=/swap-shortlink bs=1M count=4096 status=progress
  sudo mkswap /swap-shortlink
  sudo swapon /swap-shortlink
  if ! grep -qE '^/swap-shortlink[[:space:]]' /etc/fstab; then
    echo '/swap-shortlink none swap sw 0 0' | sudo tee -a /etc/fstab
  fi
)
swapon --show
free -h
```

Confirm 4 GiB swap is active before proceeding. If the filesystem rejects the swap file, stop and resolve that error first. Docker must support memory/swap controls; check `docker info` for warnings about unsupported limits.

### Build away from the VPS

Runtime limits do **not** constrain Docker image builds. Build the two Linux AMD64 images on your development machine with Docker Desktop in Linux-container mode, then transfer them. From the repository root in PowerShell:

```powershell
docker build --platform linux/amd64 -t gk-go/backend:local ./backend/Shortner
docker build --platform linux/amd64 -t gk-go/frontend:local ./frontend
New-Item -ItemType Directory -Force .local | Out-Null
docker save -o .local/gk-go-images.tar gk-go/backend:local gk-go/frontend:local
scp .local/gk-go-images.tar agent@66.116.250.218:/home/agent/shortlink_proj/
```

Also transfer the updated project source/configuration to `/home/agent/shortlink_proj`, keeping `.env.server` private. On the VPS, after configuring `.env.server` and rendering the realm as described above:

```sh
cd /home/agent/shortlink_proj
docker load -i gk-go-images.tar
docker compose --env-file .env.server -f compose.server.yml config --quiet
# Start dependencies first to avoid overlapping database and JVM startup peaks.
docker compose --env-file .env.server -f compose.server.yml up -d --no-build --wait --wait-timeout 180 db auth-db redis
docker compose --env-file .env.server -f compose.server.yml up -d --no-build keycloak
```

Wait for Keycloak logs to show successful startup, then start the remaining services:

```sh
docker compose --env-file .env.server -f compose.server.yml logs --tail=50 keycloak
docker compose --env-file .env.server -f compose.server.yml up -d --no-build backend frontend web
docker compose --env-file .env.server -f compose.server.yml ps
docker stats --no-stream
free -h
vmstat 1 10
```

Check login, link creation, redirects, and your existing sites while watching memory, swap activity, and container restarts. A running container alone does not prove readiness. If existing sites slow down or containers repeatedly restart, stop only this new project with `docker compose --env-file .env.server -f compose.server.yml stop`. Do not keep retrying startup under host memory pressure. Use `up -d --no-build` after transferring updated images on this constrained VPS.

## Connect your existing reverse proxy

For the inspected VPS (`agent@66.116.250.218`, host Nginx, Certbot, `WEB_PORT=18090`), install the supplied **new** virtual host before starting the application. This does not replace Insurance AI or portfolio configuration:

```sh
cd /home/agent/shortlink_proj
sudo test ! -e /etc/nginx/conf.d/link.gkbuilds.in.conf && sudo install -m 644 infra/nginx/link.gkbuilds.in.conf /etc/nginx/conf.d/link.gkbuilds.in.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d link.gkbuilds.in --redirect
sudo nginx -t
```

If the virtual host already exists, inspect it instead of overwriting it. Certbot will prompt for any required account details. The gateway may return 502 until the app is started; successful certificate issuance does not require the app to be running. Finish HTTPS setup before exposing signup/login. Keep `WEB_PORT=18090` for the supplied file or update its `proxy_pass` to match your chosen port.

Add a new virtual host for the hostname in `PUBLIC_ORIGIN`; keep the other projects' virtual hosts. The examples below assume the reverse proxy runs directly on the VPS host, `WEB_PORT=18090`, and standard HTTPS port 443. The public site must use HTTPS for secure cookies and authentication.

For an existing host Caddy installation, add this block to its configuration and validate/reload that installation:

```caddyfile
link.gkbuilds.in {
    reverse_proxy 127.0.0.1:18090
}
```

For an existing host Nginx installation, add this location to a **new HTTPS server block** for `link.gkbuilds.in`, using a certificate managed by your existing certificate setup:

```nginx
location / {
    proxy_pass http://127.0.0.1:18090;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Port 443;
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 16k;
}
```

Run `sudo nginx -t` before `sudo systemctl reload nginx`. Configure the hostname's HTTP-to-HTTPS redirect with your existing certificate tooling. Never replace the whole Nginx configuration with this location snippet.

If your current proxy runs **inside Docker** (Traefik, Nginx Proxy Manager, containerized Caddy, etc.), its `127.0.0.1` refers to that container. These host-proxy examples will not reach this stack from there. Adapt the connection using a dedicated shared Docker network and service routing for your actual proxy; keep the databases on the private project network. Do not expose the gateway publicly as a workaround. The unused `infra/Caddyfile` is the old standalone HTTPS configuration; the server stack now mounts `infra/Caddyfile.shared`.

After configuring the proxy, verify routing:

```sh
docker compose --env-file .env.server -f compose.server.yml ps
curl -I -H 'Host: link.gkbuilds.in' http://127.0.0.1:18090/
curl -fsS https://link.gkbuilds.in/auth/realms/shortener/.well-known/openid-configuration
curl -I https://link.gkbuilds.in/auth/admin/
```

The discovery document's issuer must be `https://link.gkbuilds.in/auth/realms/shortener`; the admin request must return 403. Substitute your hostname and chosen port where needed. The backend still ignores forwarded client IPs, so its existing IP rate limits aggregate proxy traffic; per-client ingress limits belong at the outer proxy until trusted client-IP handling is implemented.

For later deployments, load the newly built images and run the server Compose `up -d --no-build` command from this checkout. To stop only this project, use `docker compose --env-file .env.server -f compose.server.yml down` without `-v`, which retains its database volumes.

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

Anonymous browsers can create 30 successful links in total before sign-in is required. The backend persists the counter in PostgreSQL and locks it during creation, including concurrent requests. Invalid requests and alias conflicts do not consume an allowance. The HttpOnly `gkgo_visitor` cookie identifies the browser; clearing it or using another browser starts a new allowance, so this is not a per-person identity limit. IP rate limits still apply. Guest links are transferred to the signed-in account on login. Guest users can list/copy their links; editing and statistics require an account.

Production guest cookies are Secure and require HTTPS. Only local HTTP development sets `GUEST_COOKIE_SECURE=false`. Keep the API on the same origin as the frontend where possible.
