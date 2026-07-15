# Operator Readiness

This checklist separates repository evidence from target-environment approval.

## Automated Evidence

`npm run readiness` first rebuilds the native SQLite driver for Node, then
requires traceability, no-excuses and account-safety scans, the regression
baseline, and an isolated backup/restore round trip. It also runs the environment
preflight as an advisory check and prints both stdout and stderr for a failed
step so the blocker remains visible.

`npm run readiness:production` makes the production preflight blocking. Run it
with the target API environment, including strong `JWT_SECRET` and
`COOKIE_SECRET`. LARO Desktop generates equivalent per-install secrets in its
user-data directory.

## Release Checklist

- [ ] `npm ci` succeeds on supported Node 22.
- [ ] `npm run gate` and the Python test suite pass.
- [ ] `npm audit --omit=dev` reports no unresolved runtime vulnerability.
- [ ] `npm run readiness` passes, including the recovery drill.
- [ ] `npm run readiness:production` passes for an API deployment.
- [ ] The Windows portable artifact builds and launches on a clean profile.
- [ ] The scanner requires a selected case and native-picker-approved folder,
      exposes a review list, and persists a test file with matching SHA-256.
- [ ] Demo data is absent from the target database.
- [ ] `admin.invariants` and `admin.reconcileReport` are clean.
- [ ] A target-data backup is validated before migration or release.
- [ ] The emergency stop and `outreach.send.enabled` state are confirmed.
- [ ] Google, storage, LLM, and outreach providers show their intended state.
- [ ] The tagged portable executable reports Authenticode `Valid` and its
      published SHA-256 matches the release checksum.

## Supported Operating Modes

The application supports local desktop operation and an API-only container. AI,
Google import, S3 storage, and outreach delivery depend on configured providers;
when absent, those actions fail explicitly rather than fabricating results.
Outreach delivery remains disabled by default and requires operator approval,
the feature flag, provider readiness, ownership checks, idempotency, and a
released emergency stop.
