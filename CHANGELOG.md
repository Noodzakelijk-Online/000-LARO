# Changelog

All notable changes to LARO are documented here. This project follows semantic
versioning; dates are ISO. Version is sourced from `package.json` and surfaced by
`system.appInfo` / `admin.debugBundle`.

## Unreleased

### Fixed
- Replaced the desktop scanner's false offline login and fabricated upload path
  with shared-session authorization, explicit native folder consent, per-file
  review, real byte persistence, and SHA-256 provenance.
- Restricted 15-minute scanner JWTs to the evidence upload mutation and bound
  `desktop_scanner` provenance to those credentials; removed the obsolete
  all-access local-agent bearer path.
- Removed unreachable scanner, sync, mobile, OCR, annotation, and inbox
  prototypes, and removed filename-based confidence labels and invented upload
  progress from reachable evidence controls.
- Removed seven unused runtime packages and their obsolete type packages,
  reducing the install by 33 transitive packages.
- Lawyer search now stores filters under the correct directory type, removes
  fabricated recent-search counts, exposes real filters without a second panel,
  and opens the selected lawyer profile.
- Unfinished placeholder routes and the dead mock email-campaign screen are no
  longer exposed by the production renderer.
- Dashboard routes load on demand, reducing the production entry chunk from
  roughly 891 KB to 274 KB before gzip.
- Local Vite sessions use the same-origin API proxy consistently for
  `localhost` and `127.0.0.1`; authenticated Socket.IO uses resilient
  polling-first negotiation without startup console warnings.
- Packaged Desktop ignores arbitrary launch-directory `.env` files and accepts
  configuration only from deliberately shipped package resources.
- Packaged Desktop cannot inherit Vite, DevTools, or other development behavior
  from a launcher that sets `NODE_ENV=development`.
- Outreach initiation now prepares idempotent lawyer drafts in the same action,
  while approval and irreversible provider delivery remain separate controls.
- Lawyer replies can be recorded through an owner-scoped workflow action and
  update case state, response time, audit history, notifications, and analytics.
- Outreach analytics now use real user-owned pipeline, response, lawyer,
  legal-area, region, and daily trend data instead of hardcoded zero metrics.
- Operator readiness rebuilds the native SQLite driver for Node and preserves
  complete failure output after Electron packaging.
- Renderer builds force production React before Vite loads, regardless of a
  developer machine's local `.env`, preventing development-only reconnects.
- The renderer now uses a local LARO logo, and Windows packaging is configured
  with the same tracked application mark instead of a remote CDN/default icon.
- Historical readiness documentation was reconciled so current release claims
  point to reproducible gates and explicit target-environment acceptance.
- Database backup now uses SQLite's online backup API and validates integrity,
  foreign keys, and core tables before success.
- Restore now stages and validates the replacement, preserves the previous
  database, and rolls back a failed file replacement.
- Operator readiness includes an isolated backup/restore drill.
- Desktop packaging allowlists matcher data instead of shipping the unrelated
  development service and cached Python files under `assets`.
- Packaged Desktop binds to an available loopback port instead of failing when
  port 3000 is occupied.
- Explicit loopback OAuth callback configuration preserves its registered port,
  and operational endpoints report the package version consistently.
- Tagged Windows releases now fail closed on tag/version mismatch, missing
  signing credentials, or an invalid signature and publish a SHA-256 checksum.
- Tagged Windows releases support Microsoft Artifact Signing through GitHub OIDC
  as the preferred alternative to storing a PFX certificate in GitHub secrets.
- Tagged Windows releases also support SSL.com eSigner as a cloud-HSM signing
  provider that does not require an Azure subscription or local hardware token.
- Microsoft Store distribution is supported as the no-recurring-certificate
  path: CI creates and verifies an identity-bound APPX submission package for
  Microsoft to re-sign after Store certification.

## [1.3.0] — 2026-07-06
Closing renderer-independent Partials with real code.

### Added
- **14 missing routers (010/D1):** `server/routers/extendedRouters.ts` — adminAnalytics,
  outreachAnalytics, relevanceScoring, evidenceAggregation, enrichment, evidence,
  evidenceExport, bulkFileOperations, caseManagement, legalChecklists, emailMessages,
  syncScheduler, trello, unifiedInbox. Real DB-backed data or honest typed results.
- **Real outreach send (011/026/017):** `server/outreachSend.ts` + `workflow.sendApproved`
  — gated by emergency stop + `outreach.send.enabled` (default OFF) + Approved state +
  ownership + idempotency. Fails honestly with no provider. Tested (3/3).
- **Multi-user teams (106):** `server/teams.ts` + `teams` router; shared case access
  enforced in `assertCaseOwnership`; isolation preserved. Tested (3/3).
- **Supply-chain review (066):** `docs/SUPPLY_CHAIN.md` — 21 advisories triaged by
  runtime exposure (critical is dev-only vitest; 4 runtime deps scheduled).

### Status
- Matrix: **109 Implemented / 7 Partial / 0 Missing**. Tech-debt D1 RESOLVED.
- Remaining 7 Partials are all renderer/UI layer (010/013/021/041/049/050/057).

## [1.2.0] — 2026-07-06
Closing Partial phases with real code (security & data hardening).

### Added / Fixed
- **Authenticated token crypto (007/030/D4):** AES-256-GCM via `server/crypto.ts`
  (was unauthenticated CBC with a weak key); legacy values still decrypt.
- **CSRF + strict CORS (080/D5):** `server/_core/csrf.ts` — origin guard on
  mutations, never `*` with credentials.
- **Session/JWT revocation (007):** `server/sessionRevocation.ts` +
  `auth.logoutAllDevices`; verified in `context.ts`.
- **Evidence provenance (015):** sha256 content hash persisted on evidence writes.
- **ZIP evidence export (023):** `cases.exportZip` (real `archiver` package).
- **Reminders (027):** `notifications.runReminders` + daily cron, idempotent.
- **LICENSE (067):** top-level proprietary license file.

## [1.1.0] — 2026-07-06
Phases 101–115: operator-readiness, safety controls, and lifecycle.

### Added
- **Emergency stop (104):** operator kill switch (`admin.setEmergencyStop`) that
  halts all outreach prepare/approve immediately; backed by system_config.
- **Data retention (102):** `server/retention.ts` + `admin.retentionPreview/Run` —
  purges audit logs older than the retention window (default 365 days).
- **Safe retries (110):** `server/retry.ts` `retryWithBackoff` with `isRetryable`
  gating, cancellation, jitter; the live job runner now delegates to it.
- **Onboarding (105):** `onboarding.steps/state/complete` first-run flow.
- **Roles (106):** `server/_core/roles.ts` role hierarchy + `system.capabilities`.
- **Debug bundle (101):** `admin.debugBundle` redacted diagnostic snapshot (no secrets).
- **Exception dashboard (109):** `dashboard.exceptions` — only cases needing attention.
- **Real clarifications (111):** `clarifications.pending/answer` computed from case state.
- **Honest confidence (107):** `server/confidence.ts` derives confidence from real scores.
- **Operator tooling:** `npm run preflight` (103), `npm run readiness` (115),
  `npm run regression:baseline` (113), plus `CHANGELOG.md` (112).

### Notes
- Real outreach **send** remains intentionally unbuilt and flag-gated (D3).
- 14 renderer-only routers remain unimplemented (D1) — tracked, hidden work.

## [1.0.0] — earlier
Phases 000–100: honest matrix, critical path (classify→match→prepare→approve, no
send), GDPR, security hardening, tests, CI gates, audits, verification tooling.
See docs/CODEX_CHECKPOINTS.md for the full per-batch history.
