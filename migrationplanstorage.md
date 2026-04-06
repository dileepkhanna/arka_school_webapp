# Migration Plan: `localStorage` -> `httpOnly` Cookies with Laravel Sanctum

## Objective

Migrate the current SPA authentication flow from browser-managed bearer tokens in `localStorage` to server-managed session authentication using Laravel Sanctum with `httpOnly` cookies.

This plan is based on the current implementation in this project, not a generic Sanctum guide.

## Current Project Analysis

### Frontend state today

- `src/lib/apiClient.ts` stores the auth token in `localStorage` under `ase_api_token` and injects it into the `Authorization: Bearer ...` header for every request.
- `src/hooks/useAuth.tsx` hydrates auth state from that stored token, keeps a pseudo-session object with `access_token`, and clears auth on token removal.
- `src/lib/notificationStream.ts` authenticates the SSE connection by appending `access_token` as a query parameter.
- `src/pages/Auth.tsx` uses `/auth/login`, `/auth/register`, `/auth/me`, and `/auth/logout` and expects login/register to return `{ token, user }`.
- Most API traffic already goes through a single wrapper (`src/lib/apiClient.ts`), which makes the frontend migration concentrated and low-friction.

### Backend state today

- `backend/app/Http/Controllers/Api/AuthController.php` creates a random token, hashes it into `users.api_token`, and returns the plain token to the client on login/register.
- `backend/app/Http/Middleware/ApiTokenAuth.php` authenticates using `Bearer` header or `?access_token=` query string.
- Protected API routes in `backend/routes/api.php` are wrapped with custom `api.token` middleware, not `auth:sanctum`.
- `backend/app/Models/User.php` still contains `api_token` in `$fillable` and `$hidden` and does not use `Laravel\Sanctum\HasApiTokens`.
- `backend/database/migrations/2026_03_10_220000_create_school_core_tables.php` adds the `users.api_token` column.
- `backend/bootstrap/app.php` aliases only the custom middleware and does not enable stateful API middleware.
- `backend/composer.json` does not currently require `laravel/sanctum`.

### Environment and deployment observations

- The frontend is already designed to work same-origin in production via `${window.location.origin}/api` in `src/lib/apiClient.ts`.
- Vite dev proxy already forwards SPA requests to Laravel in `vite.config.ts`, which is compatible with cookie-based sessions during development.
- `backend/.env.example` already has session settings enabled (`SESSION_DRIVER=database`, `SESSION_HTTP_ONLY=true`, `SESSION_SAME_SITE=lax`), so session storage groundwork exists.
- Custom CORS in `backend/app/Http/Middleware/ApiCors.php` already sends `Access-Control-Allow-Credentials: true`, but it is not Sanctum-aware yet.

## Why migrate

- `localStorage` tokens are readable by JavaScript and therefore more exposed during XSS incidents.
- The current SSE implementation leaks the access token into the URL query string.
- The existing design only supports one live token per user because `users.api_token` is a single column.
- Sanctum session cookies fit this app well because the frontend already prefers same-origin production and centralized API access.

## Target authentication model

- Browser receives Laravel session cookie and XSRF cookie.
- Frontend never reads or stores auth credentials directly.
- Protected routes use `auth:sanctum`.
- SPA first calls `/sanctum/csrf-cookie`, then performs login/register with credentialed requests.
- `/auth/me` becomes the source of truth for authenticated user hydration.
- Logout invalidates the session on the server and clears cookie-based auth automatically.

## Migration Scope

### Files that must change

- `backend/composer.json`
- `backend/bootstrap/app.php`
- `backend/config/auth.php`
- `backend/config/cors.php` or replacement of custom CORS strategy in `backend/app/Http/Middleware/ApiCors.php`
- `backend/app/Models/User.php`
- `backend/app/Http/Controllers/Api/AuthController.php`
- `backend/routes/api.php`
- `backend/database/migrations/*` for Sanctum personal access table install if needed and later removal of `users.api_token`
- `src/lib/apiClient.ts`
- `src/hooks/useAuth.tsx`
- `src/lib/notificationStream.ts`
- `src/pages/Auth.tsx`
- backend feature tests that currently build `Authorization: Bearer ...` requests

### Areas requiring careful validation

- Cross-origin/local dev cookie behavior
- CSRF handling for `POST`, `PUT`, `DELETE`
- SSE authentication after removing query-string token support
- PWA/service worker interactions with authenticated requests
- Logout behavior across tabs

## Recommended Migration Phases

## Phase 1 - Prepare backend for Sanctum

1. Install Sanctum in `backend`.
   - Add `laravel/sanctum` to `backend/composer.json`.
   - Run Sanctum install and publish its config/migration.

2. Enable stateful API handling.
   - Update `backend/bootstrap/app.php` to enable Laravel's stateful API middleware.
   - Register `auth:sanctum`-based protection instead of the custom `api.token` guard path.

3. Update auth model configuration.
   - Add `Laravel\Sanctum\HasApiTokens` to `backend/app/Models/User.php`.
   - Remove reliance on `api_token` from the user model.

4. Add/adjust environment settings.
   - Define `SANCTUM_STATEFUL_DOMAINS`.
   - Set `SESSION_DOMAIN` correctly for production domain or shared subdomains.
   - Keep `SESSION_HTTP_ONLY=true`.
   - Keep `SESSION_SECURE_COOKIE=true` in HTTPS environments.
   - If frontend and API are on different subdomains, use compatible `SESSION_SAME_SITE` and secure cookie settings.

## Phase 2 - Replace token login with session login

1. Refactor `backend/app/Http/Controllers/Api/AuthController.php`.
   - Replace manual `api_token` creation in `login()` and `register()`.
   - Use session authentication (`Auth::attempt()` or equivalent guarded login flow).
   - Regenerate session after login.
   - Return authenticated user payload only, not a token.

2. Refactor logout.
   - Replace `api_token = null` logic with session invalidation and CSRF token regeneration.

3. Update protected routes.
   - Change the authenticated route group in `backend/routes/api.php` from `api.token` to `auth:sanctum`.

4. Keep a temporary compatibility window if needed.
   - If zero-downtime rollout is important, keep `api.token` temporarily for legacy clients behind a short-lived fallback path.
   - If this app has no external mobile/third-party clients, remove token auth directly to reduce complexity.

## Phase 3 - Make frontend credentialed instead of token-driven

1. Refactor `src/lib/apiClient.ts`.
   - Remove `TOKEN_KEY`, `getStoredToken()`, and `setStoredToken()`.
   - Remove `Authorization` header injection.
   - Add `credentials: 'include'` to all fetch calls.
   - Add an internal helper that fetches `/sanctum/csrf-cookie` before the first state-changing request and before login/register.
   - Continue using the centralized request wrapper so the migration stays contained.

2. Refactor `src/hooks/useAuth.tsx`.
   - Remove pseudo-session state based on `access_token`.
   - Hydrate auth by calling `/auth/me` directly on app load.
   - On 401, clear local auth state only; no browser token cleanup remains.
   - Replace cross-tab storage-sync logout logic with a lighter strategy such as revalidation on focus, `BroadcastChannel`, or periodic `/auth/me` refresh.

3. Refactor `src/pages/Auth.tsx`.
   - Update `signIn` and `signUp` handling to expect `{ user }` instead of `{ token, user }`.
   - Ensure login/register flow obtains CSRF cookie first.

## Phase 4 - Fix SSE and any non-fetch auth edges

1. Refactor `src/lib/notificationStream.ts`.
   - Remove `access_token` query-string auth.
   - Use `new EventSource(url, { withCredentials: true })` if browser support target allows it.
   - If browser support or infrastructure prevents credentialed `EventSource`, replace SSE with credentialed polling or a fetch-stream pattern.

2. Update backend stream auth.
   - Once using `auth:sanctum`, the notification stream route should authenticate from the session cookie instead of query parameters.

3. Review service worker and offline flows.
   - Verify any authenticated fetch performed from the PWA context still sends cookies as expected.

## Phase 5 - Remove legacy token infrastructure

1. Delete `backend/app/Http/Middleware/ApiTokenAuth.php` after all callers are migrated.
2. Remove the `api.token` alias from `backend/bootstrap/app.php`.
3. Create a migration to drop `users.api_token` once rollout is complete.
4. Remove any fallback code accepting `Authorization: Bearer` or `?access_token=`.
5. Remove frontend code paths and types that reference `access_token`.

## CORS and cookie requirements for this project

Because this app may run same-origin in production and proxied in development, Sanctum is a strong fit, but cookie rules must be explicit.

- If production is same-origin (`app.example.com` serving SPA and `/api`), setup is simplest and `SameSite=Lax` usually works.
- If production uses separate subdomains (`app.example.com` -> `api.example.com`), configure:
  - `SANCTUM_STATEFUL_DOMAINS=app.example.com`
  - `SESSION_DOMAIN=.example.com`
  - `SESSION_SECURE_COOKIE=true`
  - possibly `same_site` strategy aligned with your exact cross-site behavior
- The current custom CORS middleware is minimal. Sanctum typically works best with Laravel's standard CORS configuration and `sanctum/csrf-cookie` included in allowed paths.
- If custom CORS remains, it must correctly allow credentialed requests, origin reflection for trusted domains, and headers needed for CSRF.

## Testing impact

Current backend tests are tightly coupled to bearer tokens and `users.api_token`.

- Files in `backend/tests/Feature/*` currently create tokens manually and pass `Authorization: Bearer ...` headers.
- Those tests must be rewritten to use Sanctum helpers or session-authenticated requests.
- Remove test schema assumptions that add `api_token` to the `users` table.
- Add regression coverage for:
  - login success/failure
  - register success/failure
  - `/auth/me` with and without session
  - logout invalidating session
  - CSRF-protected mutating requests
  - notification stream auth behavior

## Main risks

### 1. SSE regression

`src/lib/notificationStream.ts` currently depends on a token query parameter. This is the most obvious auth edge case and should be migrated deliberately.

### 2. Cross-tab logout behavior changes

Today logout propagation relies on the `storage` event in `src/hooks/useAuth.tsx`. That disappears when auth data is no longer stored in browser storage.

### 3. CORS misconfiguration during subdomain deployment

Sanctum failures are usually configuration failures, not code failures. Cookie domain, stateful domains, and credentialed CORS must be validated together.

### 4. Frontend assumptions around returned token

`useAuth` and `Auth.tsx` currently assume login/register return a token. Those assumptions must be removed everywhere before rollout completes.

## Recommended execution order for this repository

1. Add Sanctum and backend session auth support.
2. Convert login/register/logout/me endpoints to session-based behavior.
3. Update `src/lib/apiClient.ts` to credentialed requests and CSRF bootstrapping.
4. Update `src/hooks/useAuth.tsx` and `src/pages/Auth.tsx` to be user-based, not token-based.
5. Migrate notification stream authentication.
6. Rewrite backend auth tests.
7. Remove `api_token` middleware and database column.

## Definition of done

- No auth token is stored in `localStorage`.
- No protected route depends on `Authorization: Bearer`.
- No URL contains `access_token`.
- SPA login, refresh, logout, and tab reopen all work using cookies only.
- Backend routes are protected with `auth:sanctum`.
- Tests no longer reference `users.api_token`.
- `users.api_token` column and custom token middleware are removed.

## Final recommendation

This project is a good candidate for Sanctum session cookies because production already trends toward same-origin API usage and the frontend has a central request layer.

The cleanest path is a two-step rollout:

1. introduce Sanctum and credentialed frontend requests,
2. then remove the legacy `api_token` system after SSE and tests are migrated.

That approach minimizes auth breakage while still ending with a fully cookie-based, `httpOnly` authentication model.
