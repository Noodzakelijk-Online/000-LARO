# Manual Verification Evidence

Current as of 2026-07-21. This document supersedes the 2026-07-06 phase
snapshot; exact release evidence is maintained in
`docs/FINAL_VERIFICATION_REPORT.md`.

## Verified Locally

- The blocking gate covers server, Electron main, and renderer TypeScript;
  ESLint; traceability; no-excuses and account-safety scans; both recovery
  drills; and the complete Node test baseline. Runtime dependency audit,
  browser accessibility, production builds, and packaging are separate release
  checks.
- Production readiness has run with strong target-like secrets and an explicit
  clean database, including integrity, foreign-key, invariant, reconciliation,
  duplicate, and demo-marker checks.
- The unsigned portable app has launched with isolated user data and returned a
  healthy production response after applying all packaged migrations.
- Browser QA covered authenticated desktop and mobile layouts, Outreach,
  lawyer filtering, case-intake autosave across close and reload, immediate case
  list refresh, and scanner consent controls without console errors.
- Packaging contents, SQLite schema, document parsers, matching data, checksum,
  and Windows signature state were inspected directly.

## Not Yet Verified

- Production Google, outbound/inbound email, optional S3, and optional
  provider-backed AI accounts have not completed target acceptance.
- Public branding awaits owner confirmation.
- Trusted public Windows distribution is not selected; the supported artifact
  is unsigned and intended for internal delivery.

Do not infer provider readiness from a successful build. Each enabled provider
requires the acceptance evidence listed in `docs/ROADMAP.md` and
`release-acceptance.json`.
