# GK GO frontend

Angular 17.3 standalone application with Tailwind CSS 3.4, a Retro-Futuristic interface, typed reactive forms, signals, lazy routes, and Keycloak authorization code flow with PKCE.

## Design direction

The UI follows the project [frontend-design skill](../.agents/skills/frontend-design/SKILL.md) using the Retro-Futuristic anchor: solid `#0A0014` surfaces, self-hosted Space Mono, magenta `#FF006E`, and cyan `#00FFFF`. The headline uses a chromatic offset, neon accents glow, and a non-interactive SVG scanline overlay supplies CRT texture without gradients. High-contrast preferences disable the scanlines and headline offset. Layout, product copy, and link-management features are retained.

## Run locally

Public signup is available through **Sign up**. Registration verifies the user's email before password setup and authenticated link creation. Local emails are captured at http://localhost:8025; password reset is available on the Keycloak sign-in page. See [server setup](../SERVER_SETUP.md) to configure real email delivery and the public hostname. Runtime `registrationEnabled` controls whether the signup action is shown.

```powershell
cd frontend
npm ci
npm start
```

Open **http://localhost:5173**. Local Keycloak redirects support both `localhost` and `127.0.0.1` on ports 4200 and 5173. `npm start` uses port 5173; `npx ng serve` uses Angular's default port 4200. Node 20.19.0 is provided as a checkout-local development dependency; npm scripts use it without changing the machine's Node installation. `.nvmrc` also records the supported Node version.

For the complete Docker stack, run `./scripts/start-local.ps1` from the repository root. It waits for service readiness and prepares the local application account. Use the `shortly-local` credentials from the ignored `.local/login.json` file. For an existing Keycloak instance, `node scripts/setup-local-auth.mjs --create-user` synchronizes the local client and creates the account without resetting existing passwords. The Angular application sends users to Keycloak to sign in and does not collect their passwords. The `shortener-dev` client allows `http://localhost:5173/*`, PKCE S256, and redirects back to the app after logout.

Start the backend on port 8090, or point the Angular development proxy to your backend:

```powershell
# Example: Java dev profile running on 8080
$env:API_PROXY_TARGET = 'http://127.0.0.1:8080'
npm start
```

The frontend proxies `/api` to `http://127.0.0.1:8090` by default. Changes to proxy settings require restarting the dev server. Short URLs returned by the API use the backend's configured `APP_BASE_URL`; ensure that URL is reachable from your browser.

## Code structure

```text
src/app/
  core/
    auth/              # Keycloak session lifecycle
    config/            # Validated runtime configuration
    errors/            # Safe API errors and global error handling
    http/              # Token scoping, timeout, session expiry
  features/
    links/
      components/      # Create-link form
      models/          # Typed API requests/responses
      pages/           # Link workspace and details
      services/        # HTTP API boundary
    insights/          # Statistics for 10 recent links
    settings/          # Read-only profile and connection information
    guide/             # Getting started
  shared/
    icons/             # Local SVG icons; no remote tracking requests
    not-found/
    toast/
    validators/
```

Components use `OnPush`, typed forms, and signals. HTTP calls are contained in API services. Subscriptions are cleaned up with `takeUntilDestroyed`. Read responses use generation checks to ignore obsolete requests after navigation/session changes. Busy states prevent duplicate submissions. Write requests are not automatically retried: after a timeout, check the link list before resubmitting.

## Features and data boundaries

- Create a short link, optionally with an alias and future expiration in the user's local time.
- Display, paginate, and search/filter links on the current page. The backend currently has no account-wide search endpoint.
- Copy links with explicit handling for clipboard permission failures.
- Pause/resume active or paused links. Expired links cannot be resumed.
- Inspect per-link recorded clicks in a native modal dialog, with focus management and Escape support.
- Inspect recent-link statistics, including partial failure states.
- Loading, empty, signed-out, unavailable-service, validation, not-found, and session-expired states.
- Live notifications, keyboard focus indicators, semantic labels, reduced-motion support, and responsive navigation.

The total link count comes from backend pagination metadata. Active and expiring metrics describe only the loaded page and are labeled accordingly. Click counts are best-effort backend records; the frontend does not invent traffic history, unique visitor counts, trends, or account-wide analytics.

## Authentication and errors

Access/refresh tokens stay in the Keycloak adapter's memory. They are never written to browser storage or logs. The functional HTTP interceptor refreshes tokens when needed and attaches them only to the exact configured API origin and path boundary. A 401 clears the session and exposes sign-in controls. The backend remains responsible for token validation and ownership enforcement.

The UI uses safe status-specific error messages for validation, authorization, missing links, conflicts, expiration, rate limits, and unavailable services. Backend request IDs and Retry-After values are available for diagnostics. Upstream HTML, SQL errors, and stack traces are not rendered. A failed application configuration shows a separate reload screen.

Runtime configuration lives in `src/assets/config.json` and is public. It contains only the API URL, identity-provider URL, realm, and client ID. Never put passwords, client secrets, or private API keys there. The config loader rejects unsafe URL schemes and mixed HTTP services when served over HTTPS.

## Verify

```powershell
npm run typecheck
npm test
npm run build
```

With the complete local stack running, install the isolated test browser with `npx playwright install chromium`, then run `npm run test:e2e`. The browser suite exercises actual Keycloak sign-in/logout, reload/session recovery, link management, and ownership checks. It creates and deletes disposable local test accounts, pauses its test links, and does not save authentication traces or videos. It also captures signed-out desktop/mobile screenshots under ignored `test-results/`.

The production build is emitted under `dist/shortly/browser`. Tests cover request validation, link status, configuration boundaries, safe errors, token scoping, session expiration, and non-retry behaviour for writes.

## Docker

From the repository root, `docker compose --profile full up --build -d` includes the frontend at http://localhost:5173. Its Nginx container proxies `/api` to the backend on the private Docker network and runs without root. The container generates public runtime configuration with `jq` from `API_BASE_URL`, `OIDC_URL`, `OIDC_REALM`, and `OIDC_CLIENT_ID`. Production must use HTTPS and deployment-specific identity-provider redirects/origins.

Angular 17 is retained as requested. It is listed under [unsupported Angular versions](https://angular.dev/reference/versions); its Node compatibility is Node 18/20. An upgrade to a supported Angular/Node release is required for an ongoing production security maintenance baseline. Do not treat framework-version pinning as a security guarantee. Tailwind setup follows the [official Angular guide](https://v3.tailwindcss.com/docs/guides/angular), and authentication uses the [official Keycloak adapter](https://www.keycloak.org/securing-apps/javascript-adapter).

Anonymous browsers receive 30 successful link creations before sign-in is required. The backend stores and enforces this allowance; the form displays the remaining count. Guest links are transferred into the account at sign-in. Browser-cookie deletion or another browser starts a new allowance; IP rate limiting remains active.
