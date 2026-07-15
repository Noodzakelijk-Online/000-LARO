# Frontend Architecture

Current as of 2026-07-15.

## Shipped surfaces

`src/renderer/main.tsx` selects two React surfaces:

- `DashboardApp`: the authenticated case, evidence, timeline, matching,
  outreach, analytics, messaging, settings, privacy, help, and administration
  workspace.
- `App`: the desktop evidence scanner, loaded only with `?mode=scanner`.

Both use the Electron-owned loopback API origin. Major dashboard routes are
lazy-loaded. The packaged entry bundle is approximately 274 KB before gzip.

## Dashboard routes

| Route | Purpose |
| --- | --- |
| `/` | Owned dashboard and next actions |
| `/cases`, `/cases/:id` | Case workflow and case command center |
| `/lawyers`, `/lawyers/:id` | Persisted lawyer directory and profiles |
| `/outreach`, `/analytics` | Outreach workflow and owned analytics |
| `/messages`, `/email` | Persisted communications |
| `/settings`, `/privacy` | User, provider, and data controls |
| `/admin`, `/admin-analytics` | Role-gated operator controls |
| `/help` | Product help and legal boundary |

Unfinished billing, reports, and email-automation routes are not mounted in the
production router.

## Scanner boundary

- The scanner reuses the authenticated main-window session; it never creates an
  offline or anonymous identity.
- It receives a 15-minute user JWT only after `auth.me` succeeds.
- Folder access is allowed only for paths returned by the native folder picker.
- Empty folder selections and implicit whole-home scans are rejected.
- Files are reviewed and selected before upload; automatic upload is forced off.
- The main process uploads real bytes through `evidenceFiles.upload`, which
  rechecks ownership and persists SHA-256 provenance.
- The scanner window uses context isolation, sandboxing, restricted navigation,
  and a narrow validated IPC bridge.

## Quality boundary

Renderer TypeScript, Electron/server TypeScript, ESLint, security scans, tests,
and recovery verification are release-blocking. External links are
protocol-checked by Electron, local API traffic is loopback-bound, and OAuth
authorization opens in the system browser.
