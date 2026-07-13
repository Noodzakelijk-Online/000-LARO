# Security

Date: 2026-07-13 | Branch: `agent/production-readiness-audit`

## Implemented controls

- The desktop creates per-install `JWT_SECRET`, `COOKIE_SECRET`, and `LOCAL_AGENT_TOKEN` values before importing the server. Standalone production startup refuses insecure placeholder secrets.
- Session cookies are HTTP-only, CSRF origins and credentialed CORS are restricted, session revocation is checked, and legacy local bearer constants work only in development.
- Case-scoped operations use authenticated ownership checks. Lawyer creation is admin-only; lawyer reads, local messages, transactional email tests, and agent controls require authentication.
- OAuth authorization URLs are created by protected tRPC procedures. Google and Microsoft flows use encrypted, time-limited state plus PKCE; the callback no longer accepts a caller-supplied user ID.
- OAuth tokens use authenticated AES-256-GCM storage. Callback pages escape provider data and use a nonce-bound script under a route-specific CSP.
- Trello OAuth is disabled until server-side encrypted token persistence exists. No token is reflected into HTML or posted to an arbitrary origin.
- Electron keeps Node integration disabled, enables context isolation and renderer sandboxing, and permits external navigation only to HTTPS, `mailto:`, or loopback HTTP URLs.
- Production startup fails if the database cannot initialize. The API binds to loopback by default; Docker explicitly opts into `0.0.0.0`.
- Provider-backed AI fails closed without `FORGE_API_KEY`. Transactional email never reports delivery when no provider is configured and does not log reset codes in production.
- Evidence storage rejects empty/traversal-only keys, confines local paths, preserves content hashes, and can use the AWS default credential chain instead of blank credentials.

## Operational requirements

- Keep standalone secrets and OAuth credentials outside Git and outside desktop artifacts.
- Keep `outreach.send.enabled` off until provider, approval, emergency-stop, ownership, and audit checks are verified in the target environment.
- Run `npm run gate`, `npm audit --audit-level=moderate`, and the Python suite before release.
- Treat the remaining renderer TypeScript contract debt as a release risk: Vite production builds are blocking, but the dedicated renderer compiler is still a non-blocking diagnostic.

## Rotation

Desktop secrets live in `userData/laro-secrets.json`. Deleting that file while LARO is stopped rotates the local signing and agent secrets on next launch and invalidates existing sessions.
