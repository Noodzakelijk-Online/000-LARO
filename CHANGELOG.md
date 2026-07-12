# Changelog

All notable changes to LARO are documented here. This project follows semantic
versioning; dates are ISO. Version is sourced from `package.json` and surfaced by
`system.appInfo` / `admin.debugBundle`.

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
