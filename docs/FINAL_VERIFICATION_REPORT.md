# Final Verification Report

Date: 2026-07-16
Verification target: the production-readiness changes in this report's commit

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
| Vitest | 33 files, 224 tests passed, 0 todo |
| Python unittest discovery | 202 tests passed |
| Runtime dependency audit | 0 known vulnerabilities |
| Renderer, main, and server production builds | Pass |
| Portable Windows packaging | Pass with tracked LARO icon; unsigned by policy |
| Packaged `/api/health` | `healthy`, database ready, version 1.3.0, production |
| Packaged document intelligence | Migration present; PDF, DOCX, and native parser dependencies present; integrated server booted successfully |
| Desktop scanner contract | Scoped 15-minute token; real bytes/hash; owner/MIME enforcement |
| Protected-main CI | Actions run `29458340785`; Node and Python jobs passed |
| Windows package workflow | Actions run `29458340759`; gate, build, ABI check, package, checksum, and artifact upload passed |
| Packaged matching assets | Seven aligned legal categories; invalid legacy dataset absent |
| Dependency graph | One canonical Node workspace; 0 open Dependabot alerts |

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

The current local portable artifact is 118,308,427 bytes with SHA-256
`0fb4f180aa3a3fd609ff1deef69724aad6e40a64a18482b34de3e4001056f39d`.
It launched with an explicit isolated user-data directory, created fresh local
secrets and databases, applied the packaged `document_analyses` migration, and
returned healthy production status on loopback port 59448. Its packaged resources
contain the current migration, PDF/DOCX parsers, native parser dependency, and
seven-category matching data. Windows reports `NotSigned`, matching the selected
unsigned internal distribution policy.

The same CI artifact was launched with `NODE_ENV=development` deliberately
injected by its parent process. It still served `/api/health` as `healthy`,
`production`, version `1.3.0`, opened only the dashboard window, and created no
DevTools or startup-error window. Packaged builds therefore cannot inherit a
development renderer path from the launching shell.

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
- Supported Gmail, Drive, local-folder, and direct uploads persist retrievable
  bytes and trigger versioned local analysis. Google-native documents are
  exported to PDF instead of being passed through an invalid media download.
- TXT, CSV, HTML, EML, PDF, and DOCX evidence produces source-grounded parties,
  dates, amounts, claims, obligations, legal issues, risks, and chronology.
  Optional provider enrichment is retained only when every observation resolves
  to an extracted source segment.
- The active case workspace exposes document analysis and an automatically
  generated evidence timeline. Each event retains a compact source control that
  opens the owned evidence document.
- Lawyer matching loads a valid curated terminology dataset whose seven category
  keys are checked against the specialization taxonomy. It no longer silently
  falls back around the truncated asset or claims unsupported 877k-case scoring.
- The obsolete nested `assets` npm/Electron workspace was removed. It was not a
  runnable product surface and was the sole source of 72 stale dependency alerts.
- `main` requires pull requests, strict Node/Python status checks, stale-review
  dismissal, resolved review conversations, and disallows force pushes/deletion.

## External acceptance still required

| Gate | Current state | Required evidence |
|---|---|---|
| Trusted public Windows distribution | Deliberately out of scope | Configure Store or certificate signing only if the distribution policy changes from unsigned internal delivery |
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

The repository is a verified unsigned internal release candidate: the code,
tests, recovery path, packaged startup, authenticated realtime channel, and
tested user flow are operational. Public signing and Store certification are not
part of the selected distribution path. The artifact must therefore remain an
internal build and may show Windows' unknown-publisher warning. Live-provider
and public-brand acceptance remain environment and owner gates respectively.
