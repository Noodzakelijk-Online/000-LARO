# Final Verification Report

Date: 2026-07-20
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
| Target database readiness | SQLite integrity, declared foreign keys, 228 legacy relationship guards, invariants, reconciliation, duplicates, and demo markers clean |
| Vitest | 42 files, 271 tests passed, 0 todo |
| Python unittest discovery | 202 tests passed |
| Runtime dependency audit | 0 known vulnerabilities |
| Renderer, main, and server production builds | Pass |
| Portable Windows packaging | Pass with tracked LARO icon; unsigned by policy |
| Packaged `/api/health` | `healthy`, database ready, version 1.3.0 |
| Packaged document intelligence and Outreach | Six migrations present, including persisted keyword-pull jobs; PDF, DOCX, native parser dependencies, and review-gated Outreach tables present; integrated server booted successfully |
| Desktop scanner contract | Scoped 15-minute token; real bytes/hash; owner/MIME enforcement |
| Branch CI policy | Current Node and Python checks are required before merge |
| Protected-main CI | Actions run `29710137158`; Node and Python jobs passed |
| Windows package workflow | Actions run `29710137156`; gate, build, ABI check, package, checksum, and artifact upload passed |
| Packaged matching assets | Seven aligned legal categories; invalid legacy dataset absent |
| Dependency graph | One canonical Node workspace; 0 open Dependabot alerts |

`npm run readiness:production` passed with strong target-like secrets and an
explicit clean target database. The readiness command restores the Node SQLite
ABI itself after Electron packaging, runs the data-readiness gate, and preserves
complete stdout/stderr for any failed step.

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
- case intake restored a draft after immediate close and full reload, retained
  the dialog on failure by contract, updated the case list after successful
  creation without a manual reload, and cleared the persisted draft only after
  success.

A second packaged-window run exercised the rebuilt scanner surface:

- account signup established the shared authenticated desktop session;
- the scanner opened on the package-selected loopback port and loaded the real
  empty case state without console warnings or errors;
- folder selection remained available, while scan execution stayed disabled
  without both a selected case and a native-picker-approved folder;
- Settings opened and returned to evidence collection; the viewport had no
  horizontal overflow or overlapping controls.

The 2026-07-20 isolated-profile package check additionally verified account
signup, the retained Gmail and Google Drive connection controls, the local-folder
picker entry point, user-scoped account and activity exports, mobile navigation,
and a clean browser console. Settings no longer exposes inert outreach,
notification, matching, personalization, or restorable-backup controls.

A clean-profile packaged evidence run then created a case, configured a local
folder, and pulled 40 matching text records through the real background job:

- the interface exposed queued/running state, word and item counters, progress,
  completion state, and disabled conflicting controls while work was active;
- completion reported actual extracted-document words and `40 / 40 items`, and
  persisted one job;
- all 40 records were extracted and analyzed, and the visible evidence list
  replaced its empty state automatically without a reload;
- the consolidated Timeline workspace generated 40 source-linked legal events,
  exposed Legal events, Source documents, and Case activity views, and switched
  between vertical and horizontal layouts while retaining all 40 source buttons;
- desktop and 390x844 responsive checks had no page-level horizontal overflow,
  framework overlay, console error, or console warning.

A final clean-profile packaged run created a new local account and checked all
14 mounted routes at both 1440x900 and 390x844:

- all 28 route/viewport combinations rendered meaningful content and an `h1`;
- no route had horizontal overflow, unnamed visible buttons, unlabeled visible
  fields, missing image alternative text, blank content, or a framework error;
- the 366x820 assistant remained inside the 390x844 viewport and exposed named
  open, minimize, close, input, and send controls;
- the notification popover, Help accordion, and Case Notes compose flow worked
  without fabricated delivery filters or support promises;
- the shell used the packaged LARO favicon and title, and authentication exposed
  correct email, current-password, new-password, and one-time-code metadata;
- no page error, console error, or console warning occurred during the sweep.

The authenticated shell also carries a compact, programmatically named
legal-assistance notice on every route. A development-renderer check created a
real local account, moved from Home to Cases, and observed the notice after both
renders with no console warning, console error, framework overlay, or horizontal
overflow at 2560x1440.

The current local portable artifact is 151,689,956 bytes with SHA-256
`ce8baac8729583de42f3ff08cab1ee9ce645505288650ebb3505b83b3a3e8259`.
It launched with an explicit isolated user-data directory, created fresh local
secrets and databases, applied all six packaged migrations, and served the
application on loopback port 57690. SQLite integrity passed with zero foreign-key
violations and all 228 required relationship guards persisted.
Its packaged resources contain the current migrations, PDF/DOCX parsers, native
parser dependency, consolidated managed-storage deletion, and seven-category
matching data. Windows reports
`NotSigned`, matching the selected unsigned internal distribution policy.

The same CI artifact was launched with `NODE_ENV=development` deliberately
injected by its parent process. It still served `/api/health` as `healthy`,
`production`, version `1.3.0`, opened only the dashboard window, and created no
DevTools or startup-error window. Packaged builds therefore cannot inherit a
development renderer path from the launching shell.

## Verified product path

- Core local workflows are unmetered. Usage telemetry stores operation and
  quantity counts only; there is no checkout, upgrade, quota, or payment-provider
  enforcement path.
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
- Evidence, case, and account deletion remove owned managed-storage objects
  before metadata and abort on storage or database failure instead of silently
  leaving partial data.
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
| Trusted public Windows distribution | Deliberately out of scope | Configure Store or certificate signing only if platform publisher trust becomes a requirement; unsigned tagged delivery remains supported with a checksum and warning |
| Public branding | Awaiting owner confirmation | Product owner confirms `build/icon.png` / `public/laro-logo.png` as the approved public mark |
| Live providers | Not exercised with production accounts | Target Google OAuth, storage/LLM as used, and outbound email credentials pass consent, send, callback, and audit checks |

These external states are represented in `release-acceptance.json`. Normal
development builds may retain pending gates, but the tagged release workflow
requires reviewed approver, timestamp, evidence, and provider-scope records
before it can publish.

## Residual engineering work

- The Electron and Flask runtimes still have separate schemas and databases.
- Historical tables use non-destructive database relationship triggers until a
  future backup-tested migration can replace them with native foreign keys;
  reconciliation remains the explicit repair path for pre-existing drift.
- Route-level lazy loading keeps the production entry chunk near 276 KB before
  gzip; the largest route chunk is near 266 KB.
- Full i18n migration and additional cross-browser/a11y automation remain useful
  hardening work.

## Verdict

The repository is a verified unsigned release candidate: the code,
tests, recovery path, packaged startup, authenticated realtime channel, and
tested user flow are operational. Public signing and Store certification are not
part of the selected distribution path. Windows may show an unknown-publisher
warning. Live-provider and public-brand acceptance remain environment and owner
gates respectively and continue to block a versioned release until recorded.
