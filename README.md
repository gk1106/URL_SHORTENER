# URL Shortener

Java 17 / Spring Boot 4.1.2 backend with Oracle, Flyway, Spring Security OIDC bearer authentication, Redis, Log4j2, and bounded asynchronous click counting. The [Angular 17 frontend](frontend/README.md) includes a glossy Tailwind CSS workspace, secure sign-in, link management, and click statistics.

## Code organization

Application code lives under `backend/Shortner/src/main/java/com/urlshortener` using lowercase Java packages and a layered structure:

```text
com/urlshortener/
  ShortenerApplication.java
  controller/     # REST endpoints and redirects
  service/        # LinkService interface
    impl/         # LinkServiceImpl, transactional writer, async click recorder
  repository/     # Spring Data persistence interfaces
  entity/         # JPA entities
  dto/            # Separate request and response records
  config/         # Application, JWT, and Spring Security configuration
  security/       # Request and rate-limit filters
  exception/      # Application exceptions, controller advice, problem responses
  cache/          # Redis redirect lookup
  validation/     # Destination URL validation
```

Controllers depend on the service interface. Service implementations coordinate repositories, entities, validation, and cache operations. Tests use matching configuration/security packages plus a separate integration package.

## Quick local start

Install Java 17 and Docker Desktop. From the repository root:

```powershell
Copy-Item .env.example .env
# Edit .env: replace each password placeholder with a unique local password.
docker compose up -d keycloak
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
cd backend/Shortner
./mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=dev'
```

The `dev` profile uses an in-memory H2 database, disables Redis caching/rate limiting, and keeps authentication enabled. Data is lost when the application stops. Authentication uses the local Keycloak realm. No default application users or passwords are shipped.

Open http://localhost:8180, sign in as `admin` with your `.env` admin password, select the `shortener` realm, and create a user with a permanent password. For browser applications use authorization code flow with PKCE (`shortener-dev` client). The API audience is `shortener-api`.

For terminal testing, use the device authorization flow without exposing a password to the API:

```powershell
$oidc = 'http://localhost:8180/realms/shortener/protocol/openid-connect'
$device = Invoke-RestMethod -Method Post "$oidc/auth/device" -Body @{client_id='shortener-dev'; scope='openid'}
$device.verification_uri_complete
# Open that URL, sign in as your application user, and approve the device.
# Respect the returned interval before polling. authorization_pending means approval is still pending.
Start-Sleep -Seconds $device.interval
$token = Invoke-RestMethod -Method Post "$oidc/token" -Body @{
    grant_type='urn:ietf:params:oauth:grant-type:device_code'
    client_id='shortener-dev'
    device_code=$device.device_code
}
$headers = @{Authorization="Bearer $($token.access_token)"}
$link = Invoke-RestMethod -Method Post 'http://localhost:8080/api/v1/urls' -Headers $headers -ContentType 'application/json' -Body '{"longUrl":"https://example.com","alias":"my-demo"}'
$link
Invoke-RestMethod 'http://localhost:8080/api/v1/urls' -Headers $headers
# Open $link.shortUrl in a browser to redirect.
```

Keycloak container usage follows the [official development container guide](https://www.keycloak.org/getting-started/getting-started-docker). This Compose setup uses `start-dev`, HTTP, and localhost ports for local development only.

## Full local stack

From the root, after configuring `.env`:

```powershell
docker compose --profile full up --build -d
docker compose --profile full logs -f backend
```

This starts Oracle Free, password-protected Redis, Keycloak, and the backend at http://localhost:8090 (`APP_PORT` in `.env` overrides the port). Use port 8090 instead of 8080 in the API examples for this stack. Oracle stays on the private Docker network. Oracle's first start can take several minutes. Volumes persist database/authentication data; later `.env` changes do not change existing database or Keycloak passwords. `docker compose --profile full down` stops the stack and retains data.

Run `python scripts/smoke-stack.py` from the root to check the live stack. It creates and removes temporary Keycloak clients, creates one disabled test link, and checks authentication, ownership, redirects, click counts, cache consistency, and rate limits. It reads local `.env` credentials without printing them.

## API

Management routes require `Authorization: Bearer <access-token>`. Each user's subject identifies their links. Other users' link IDs return 404 to avoid disclosing ownership.

| Method | Route | Result |
| --- | --- | --- |
| POST | `/api/v1/urls` | 201, link response and Location header |
| GET | `/api/v1/urls?page=0&size=20` | Owned links, stable pagination; max size 100 |
| GET | `/api/v1/urls/{id}` | Owned link |
| PATCH | `/api/v1/urls/{id}` | Change `active` and/or future `expiresAt` |
| GET | `/api/v1/urls/{id}/stats` | Best-effort click count |
| GET / HEAD | `/r/{code}` | Public 302 with `Cache-Control: no-store` |
| GET | `/actuator/health` | Public health, no dependency details |
| GET | `/actuator/metrics` | Requires `metrics.read` scope |

Create body:

```json
{"longUrl":"https://example.com/path","alias":"optional-alias","expiresAt":"2030-01-01T00:00:00Z"}
```

Omit `alias` to generate a cryptographically random 10-character Base62 code. Aliases are case-sensitive, 4–32 characters, using letters, digits, `_`, and `-`; reserved names are rejected. Destinations accept HTTP/HTTPS without credentials, up to 2048 ASCII characters. The backend does not fetch destination content. This is a redirect service, so destination validation is not a phishing/malware reputation system.

PATCH example: `{"active":false}`. An omitted/null expiration preserves the current expiration; removing an expiration is not supported. Expiration is enforced on every redirect without requiring a cleanup job. Links and aliases are retained for audit/history rather than automatically deleted. HEAD requests do not increment click counts.

Errors use `application/problem+json` with a request ID. Statuses: 400 invalid input, 401 missing/invalid authentication, 403 forbidden, 404 missing/unowned link, 409 alias/update conflict, 410 inactive/expired, 413 body over 16 KiB, 429 rate limited, 503 unavailable dependency or allocation failure. Error messages do not expose SQL or stack traces.

## Configuration and deployment

Default configuration requires `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `OIDC_ISSUER_URI`, `OIDC_JWK_SET_URI`, `APP_BASE_URL`, and `CORS_ALLOWED_ORIGINS`. Oracle migrations run automatically and Hibernate validates the schema. Use a dedicated database account; split migration credentials from runtime credentials for production deployments.

Optional Redis settings: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL_ENABLED`. Rate limits default to 60 management requests per user per minute and 300 redirects per source IP per minute. Redis increments/expiry are atomic. Rate limiting fails closed with 503 if Redis is unavailable. Redirect caching falls back to the database on Redis errors. Cache entries map codes to IDs; authoritative database checks preserve immediate disable/expiration semantics. This cache does not eliminate the database read.

The application ignores forwarded headers. Behind a trusted reverse proxy, configure and test the deployment's trusted proxy handling so IP limits reflect the actual client. Use TLS externally, restricted database/Redis networking, a production OIDC deployment, rotated secrets, backups, and monitored resource limits. JWT validation checks RS256 signatures, issuer, timestamps, expiry presence, audience, and a nonblank subject.

Log4j2 writes key/value console logs with generated `X-Request-ID` correlation. Application logs contain internal link IDs rather than destinations or tokens. SQL parameter logging is disabled. Metrics are available through Actuator to tokens carrying `metrics.read`; other management endpoints are denied.

Click recording uses 2–4 platform threads, a bounded queue of 500 tasks, MDC propagation, and graceful shutdown. Database increments are atomic. Overload drops analytics instead of blocking redirects; process crashes or database errors may also lose click events. Statistics are eventually consistent and count HTTP GET requests, including bots/repeated visits, not unique visitors. Durable/exact analytics would require a persistent queue or outbox and event deduplication.

## Verification

```powershell
cd backend/Shortner
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
./mvnw.cmd -B clean verify
```

Tests cover persistence/migrations on H2, redirects, ownership, validation, expiration/disabling, collision races, concurrent atomic clicks, token claim validation, and rate limiter decisions. Docker/Oracle/Redis/Keycloak end-to-end checks require a running local stack and are distinct from H2 tests. CI runs `verify` on Java 17. The Docker build also runs verification and uses a nonroot runtime user.

The frontend, malware reputation checks, durable analytics, and scheduled data retention are outside this backend implementation. Load and operational testing against the target deployment remain necessary before production rollout.
