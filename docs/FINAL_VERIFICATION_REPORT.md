# Final Verification Report

Date: 2026-07-15
Branch: `main`
Commit: `677a46a62577792c4acf2811b475ca2f1bf4d040`

This report separates reproducible repository evidence from target-environment
acceptance. It supersedes the 2026-07-06 phase snapshot.

## Automated release evidence

| Gate | Result |
|---|---|
| Server, Electron main, and renderer TypeScript | Pass |
| ESLint | Pass |
| Requirements traceability | 116 rows, 93 cited, 0 broken |
| Runtime no-excuses scan | 0 suspect findings |
| Account-safety scan | 0 high-severity findings |
| Isolated backup/delete/restore/reopen drill | Pass |
| Vitest | 32 files, 217 tests passed, 0 todo |
| Python unittest discovery | 202 tests passed |
| Runtime dependency audit | 0 known vulnerabilities |
| Renderer, main, and server production builds | Pass |
| Unpacked Windows packaging | Pass with tracked LARO icon |
| Packaged `/api/health` | `healthy`, database ready, version 1.3.0, production |
| Desktop scanner contract | Scoped 15-minute token; real bytes/hash; owner/MIME enforcement |
| Protected-main CI | Actions run `29455232706`; Node and Python jobs passed |
| Windows package workflow | Actions run `29455232654`; gate, build, ABI check, package, checksum, and artifact upload passed |
| Packaged matching assets | Seven aligned legal categories; invalid legacy dataset absent |

`npm run readiness:production` also passed with strong target-like secrets. The
readiness command now restores the Node SQLite ABI itself after Electron
packaging and preserves complete stdout/stderr for any failed step.

## Packaged UI evidence

Playwright exercised the unpacked Windows application at 1440x900 and 390x844:

- sign in with a real persisted account;
- authenticated Socket.IO connection established without console warnings;
- Outreach opened from the sidebar;
- real empty-state metrics, pipeline, quality, and daily activity rendered;
- reporting period changed from 30 to 90 days;
- desktop and mobile layouts remained readable without overlap or horizontal
  tab/content compression.
- lawyer directory search used real loaded records, legal-area and text filters
  updated the result set, and View Profile opened the selected persisted record;
- development proxy, CSRF, and authenticated Socket.IO negotiation completed on
  `127.0.0.1` with no console errors or warnings.

A second packaged-window run exercised the rebuilt scanner surface:

- account signup established the shared authenticated desktop session;
- the scanner opened on the package-selected loopback port and loaded the real
  empty case state without console warnings or errors;
- folder selection remained available, while scan execution stayed disabled
  without both a selected case and a native-picker-approved folder;
- Settings opened and returned to evidence collection; the viewport had no
  horizontal overflow or overlapping controls.

The CI portable artifact is 104,514,968 bytes with SHA-256
`c6cf367f112b4dc4fd64d749666f00ae169a175a4f2a168aaf1159a06dc3cb38`.
The downloaded executable matched its published checksum, launched the real
dashboard window with an active renderer, and did not reproduce the obsolete
`dist/main/index.js` startup error. Its packaged resources contain the current
seven-category `legal-keywords.json` and no truncated legacy dataset. Windows
reports `NotSigned`, matching the external signing gate below.

## Verified product path

- Case creation, deterministic classification, lawyer matching, and idempotent
  draft preparation are real database-backed actions.
- Starting outreach prepares reviewable drafts in one action. It does not send.
- Approval and irreversible delivery remain separate. Delivery requires the
  owner, Approved state, enabled feature flag, released emergency stop, a real
  provider, and an unsent idempotency state.
- Lawyer responses are owner-scoped and update response timing, audit history,
  notifications, analytics, and the matched case state when interested.
- Outreach analytics are derived from the authenticated user's records rather
  than mock counters.
- Persisted notifications are emitted only to the authenticated user's realtime
  room; the client retains polling as a recovery path.
- Desktop scanning requires explicit native folder consent and per-file review;
  selected bytes are persisted through the canonical evidence upload route with
  content-hash provenance. Scanner bearer tokens cannot access other protected
  procedures.
- Lawyer matching loads a valid curated terminology dataset whose seven category
  keys are checked against the specialization taxonomy. It no longer silently
  falls back around the truncated asset or claims unsupported 877k-case scoring.
- `main` requires pull requests, strict Node/Python status checks, stale-review
  dismissal, resolved review conversations, and disallows force pushes/deletion.

## External acceptance still required

| Gate | Current state | Required evidence |
|---|---|---|
| Windows signing | Blocked externally | `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD`; tagged artifact reports Authenticode `Valid` |
| Public branding | Awaiting owner confirmation | Product owner confirms `build/icon.png` / `public/laro-logo.png` as the approved public mark |
| Live providers | Not exercised with production accounts | Target Google OAuth, storage/LLM as used, and outbound email credentials pass consent, send, callback, and audit checks |

These external states are represented in `release-acceptance.json`. Normal
development builds may retain pending gates, but the tagged release workflow
requires reviewed approver, timestamp, evidence, and provider-scope records
before it can publish.

## Residual engineering work

- The Electron and Flask runtimes still have separate schemas and databases.
- Application-level reconciliation remains important until more invariants are
  declared as database foreign keys.
- Route-level lazy loading keeps the production entry chunk near 274 KB before
  gzip; the largest route chunk is near 230 KB.
- Full i18n migration and additional cross-browser/a11y automation remain useful
  hardening work.

## Verdict

The repository is a verified internal release candidate: the code, tests,
recovery path, packaged startup, authenticated realtime channel, and tested user
flow are operational. It must not be represented as a publicly signed production
release until the three external acceptance gates above are evidenced.
