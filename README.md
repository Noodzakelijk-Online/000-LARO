# LARO: Legal Aid Reach Out

LARO is a local-first legal case workspace for collecting evidence, understanding source documents, building a reviewable chronology, matching support, and preparing controlled outreach. Its core design principle is provenance: findings should lead back to the document and passage that support them.

LARO assists with organization and preparation. It is not a lawyer, does not provide definitive legal advice, and must not present generated analysis as a confirmed legal conclusion. External communication is never implicit: approval, feature, provider, ownership, and emergency-stop checks protect the send path.

## Current Architecture

This repository contains two supported runtimes while the platform is being consolidated. They share a repository and can share selected credentials, but they are not yet one application and do not share a database.

| Runtime | Primary use | Source | Default address | Persistence |
| --- | --- | --- | --- | --- |
| Electron desktop + Express/tRPC | Desktop case workflow, connectors, matching, controlled outreach, administration | `src-main/`, `src/renderer/`, `server/` | `http://localhost:3000` inside Electron | SQLite via Drizzle plus local or S3 evidence storage |
| Flask Case Command Center | Source-linked legal ledger, document intelligence, Papertrail, evidence timelines, bundles, matching, and outreach preparation | `app.py`, `legal_ledger.py`, `frontend/` | `http://127.0.0.1:8768/case_command_center.html` | `instance/laro_ledger.sqlite3` plus ignored local uploads and token vault |

The Electron main process starts the Express/tRPC server and React renderer together. `npm run dev:server` runs only that API server. The Flask launcher binds to loopback by default and uses `LARO_FLASK_PORT=8768`, so both runtimes can run at the same time.

## Capabilities

### Case and evidence work

- Persist cases, parties, identifiers, status, risk, deadlines, obligations, open loops, claims, positions, and audit history.
- Upload or stage PDF, DOCX, HTML, text, email-shaped, and Drive-shaped records while retaining source metadata and content hashes.
- Keep case-neutral documents in an inbox until a user reviews deterministic case suggestions and explicitly links them.
- Pull selected Gmail and Google Drive records through real read-only OAuth when credentials are configured.
- Run desktop keyword pulls as persisted, resumable jobs with live source phase,
  extracted-word and item counts, percentage, and estimated seconds remaining.
- Deduplicate imported evidence while preserving source URIs and locally retrievable files.
- Scan only folders selected through the native desktop picker, review the discovered files, and upload only the selected evidence.
- Standalone servers reject local-folder collection unless the path resolves
  inside an operator-configured `LOCAL_SCAN_ROOTS` allowlist.
- Store actual scanner bytes under the owned case with SHA-256 provenance; scanner credentials expire after 15 minutes and cannot call other protected APIs.
- Persist Gmail messages, attachments, local files, and Drive files under the same evidence contract; Google-native documents are exported to analyzable PDF while retaining their source identity.
- Score case evidence against persisted case context and source-linked document analyses, with the score, matched terms, method, and reasoning retained in evidence metadata.
- Export a case-scoped CSV index or ZIP evidence package containing provenance metadata, analyses, and every available managed source document.

### Document intelligence and Papertrail

- Extract readable text and create review-only suggestions for events, claims, evidence links, contradictions, deadlines, obligations, and missing evidence.
- Analyze TXT, CSV, HTML, EML, PDF, DOCX, and JPEG/PNG/GIF/WebP/BMP image evidence locally in the desktop runtime; Dutch and English image OCR feeds the same versioned summaries, parties, dates, amounts, claims, obligations, legal issues, risks, and source spans. Scanned PDFs must first be converted to images.
- Run local citation extraction automatically for supported Gmail, Drive, and folder imports; optional deep analysis is accepted only when every finding cites a real extracted source segment.
- Run full-source deterministic comparisons or optional loopback-only Ollama analysis in bounded batches.
- Reject uncited model observations; retained suggestions include literal source support and remain unconfirmed until reviewed.
- Build who-said-or-did-what-and-when timelines with actor, action, affected party, event type, date, summary, and direct document access.
- Browse source-linked legal events horizontally or vertically, source documents,
  and operational case activity from one Timeline workspace.
- Generate source-linked case summaries, lawyer briefings, red-line drafts, and approval-bound case bundles.

### Matching and outreach

- Query the official NOvA public lawyer finder from the desktop case workspace, retain source/profile provenance, and rank lawyers using the case's legal fields plus only attributes that are actually available. Unknown capacity, availability, or performance receives no invented score.
- Apply official legal-area, city/postcode, radius, specialization-association, and financed-legal-aid filters. City/postcode sharing is explicit; LARO does not send case prose or a client's stored address to NOvA.
- Use one desktop Outreach workspace for analytics, lawyers, media, and organizations. Media and organization candidates remain pending until a user approves or rejects their public source.
- Discover or manually import media/organization candidates from bounded public searches, deduplicate them per owner and category, and rank only approved records against the selected case. Discovery sends canonical legal-area queries, never case prose, and does not claim exhaustive internet coverage.
- The Flask Case Command Center retains its own reviewable target directory. Flask and Electron outreach records are not silently synchronized.
- Track outreach totals, progress, responses, acceptance, and pending work per case.
- Prepare and approve outreach drafts without sending them automatically.
- Send an approved desktop-runtime lawyer outreach only when the global emergency stop is released, `outreach.send.enabled` is enabled, the caller owns the case, a real email provider is configured, and the idempotency guard has not already recorded the send.

## Prerequisites

- Windows 10/11 for the primary desktop and PowerShell workflow.
- Node.js 22.12 or newer in the Node 22 LTS line. CI, Electron 43, and the native-module rebuild scripts use this baseline.
- Python 3.11 or newer for the Flask Case Command Center.
- C++ build tools may be needed if npm cannot obtain a compatible native binary.
- Optional: a local [Ollama](https://ollama.com/) installation for deeper local document reading.
- Optional: provider credentials for Google, Microsoft, S3, Trello, Telegram, AI models, or outbound email.

## Desktop Quick Start

From the repository root in PowerShell:

```powershell
npm ci
npm run setup
npm run dev
```

`npm run setup` creates `.env` from `.env.example` only when `.env` does not already exist. It never overwrites existing configuration. The packaged desktop app atomically creates durable local JWT and cookie secrets in its Electron user-data directory; standalone production server operation requires strong values in `.env`. Keep `laro-secrets.json` with its matching database backup because it also protects encrypted provider tokens. A desktop single-instance lock prevents concurrent processes from opening that shared profile; a later launch restores and focuses the existing window. Electron browser permissions are denied by default because LARO uses reviewed native IPC for local-file selection and external links instead of browser device APIs.

Useful desktop commands:

```powershell
npm run dev:server       # Express/tRPC API only, port 3000
npm run doctor           # environment and native-module checks
npm run lint             # TypeScript/TSX correctness lint
npm test                 # Vitest suite
npm run gate             # blocking quality and safety gates
npm run test:a11y:browser # 15-route Playwright/axe renderer audit
npm run build            # renderer, main process, and server builds
npm run dist:win         # Windows package
```

## Flask Quick Start

From the repository root in PowerShell:

```powershell
python -m pip install -r requirements.txt
Copy-Item .env.example .env
.\run_local.ps1
```

Open [http://127.0.0.1:8768/case_command_center.html](http://127.0.0.1:8768/case_command_center.html). To use another local port:

```powershell
.\run_local.ps1 -Port 8770
```

The convenience session bootstrap is loopback-only and accepts only `LARO_LOCAL_ACCOUNT_EMAIL` (default `robert.local@laro`). It is not a remote authentication mechanism. Use the password route for additional accounts.

## Configuration

Copy `.env.example` to `.env`; never commit real secrets. The template is grouped by runtime:

| Area | Important variables |
| --- | --- |
| Desktop server | `NODE_ENV`, `HOST`, `PORT`, `API_BODY_LIMIT`, `JWT_SECRET`, `COOKIE_SECRET` |
| Development renderer | `VITE_LARO_API_URL` (API proxy target when it is not `http://127.0.0.1:3000`) |
| Desktop data | `DATABASE_URL`, `LOCAL_STORAGE_DIR`, `AWS_S3_*` |
| Standalone local scan | `LOCAL_SCAN_ROOTS` (path-delimited allowlist; desktop uses the native folder picker) |
| Provider-backed desktop AI | `FORGE_API_URL`, `FORGE_API_KEY` |
| Optional connectors | `MICROSOFT_*`, `TELEGRAM_BOT_TOKEN`, `SENDGRID_API_KEY`, `SMTP_*` |
| Flask server | `LARO_FLASK_PORT`, `LARO_HOST`, `LARO_DEBUG`, `SECRET_KEY` |
| Flask ledger | `LARO_LEDGER_DATABASE_URL`, `LARO_UPLOAD_ROOT`, `LARO_MAX_UPLOAD_BYTES`, `LARO_BUNDLE_MAX_BYTES` |
| Flask identity and vault | `LARO_AUTH_DATABASE_PATH`, `LARO_LOCAL_ACCOUNT_EMAIL`, `LARO_TOKEN_STORE_DIR`, `LARO_TOKEN_ENCRYPTION_KEY` |
| Flask password reset | `LARO_PASSWORD_RESET_URL_TEMPLATE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_STARTTLS` |
| Local analysis | `LARO_ANALYSIS_PROVIDER`, `LARO_OLLAMA_BASE_URL`, `LARO_OLLAMA_MODEL`, `LARO_LOCAL_ANALYSIS_MAX_CHARS` |
| Google intake | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |

Keep `LARO_HOST` and `LARO_OLLAMA_BASE_URL` on loopback for the local Flask workflow. The Flask analysis engine rejects a non-loopback Ollama endpoint.

### Google Gmail and Drive

For the Flask runtime, configure a Google OAuth client with this callback:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:8768/api/google/oauth/callback
```

After OAuth succeeds, the UI updates its connection state without a manual page refresh. Pulls run as durable jobs and report persisted source, document, word, character, elapsed-time, and ETA progress. Imported records retain their original URI and read audit. Raw refresh credentials are encrypted in the ignored local `tokens/` vault; the ledger stores connection metadata and a token fingerprint, not the raw token.

The Flask password-login path stores users and hashed bearer sessions in the ignored SQLite auth database. It does not seed sample accounts. Password reset tokens are stored only as SHA-256 digests, expire after 15 minutes, are single-use, invalidate existing sessions, and are delivered only through configured SMTP or an application-injected delivery hook.

## Review and Safety Model

- Extracted events and legal observations are suggestions, not confirmed facts.
- Every retained AI observation must cite source text; uncited model output is discarded.
- Case ownership is enforced on authenticated case, document, approval, audit, and matching routes.
- Approving a draft does not send it.
- Desktop outreach send is off by default through `outreach.send.enabled` and is overridden by the global emergency stop.
- A failed or missing email provider does not produce a false `Sent` state.
- Bundle approval is tied to the exact persisted case snapshot. Later evidence, analysis, outreach, draft, or case changes invalidate that approval.
- Bundle manifests include SHA-256 digests and omit credential-shaped fields and machine-local paths from structured exports.
- GDPR exports omit password, reset-token, OAuth-token, API-key, secret, authorization, and cookie fields across every owner table. Optional privacy preferences persist per account and are included in export and erasure.
- Audit retention uses a bounded 30-3650 day configuration, catches up after startup, and runs daily without deleting owner business data.

See [Operator Runbook](docs/OPERATOR_RUNBOOK.md), [Security](docs/SECURITY.md), [Privacy](docs/PRIVACY.md), and [Threat Model](docs/THREAT_MODEL.md) before operating with real case data.

## Verification

The current production-readiness candidate was verified locally on 2026-07-20.
GitHub Actions repeats the Node and browser checks on the supported Node 22 toolchain:

- `npm run gate`: all blocking gates passed.
- Server, Electron main-process, and shipped renderer TypeScript checks passed; no shipped runtime module disables type checking; ESLint passed.
- Traceability reported 116 rows, 91 cited, and 0 broken references.
- Runtime no-excuses scan reported 0 suspect findings; account safety reported 0 high-severity findings.
- Vitest reported 46 passing files and 287 passing tests, including controlled
  NOvA parsing/filter, unknown-metric scoring, and review-gated
  media/organization discovery, tenant isolation, case-draft persistence, and
  target-database readiness tests, with no skipped or todo tests.
- Full Python discovery reported 202 passing tests. Warning-focused optimization and UCID tests also passed with deprecations promoted to errors.
- The Vite 8 renderer, Electron 43 main process, and standalone server builds completed successfully.
- The scanner integration test verified scoped-token isolation, owner checks, supported MIME enforcement, exact stored bytes, and SHA-256 readback.

The packaged desktop ignores `.env` files in its launch directory and normally
asks Windows for an available loopback port. Setting
`OAUTH_REDIRECT_BASE_URL` to an explicit `localhost` or `127.0.0.1` port pins the
desktop server to that registered OAuth callback port instead.
- `npm audit` reported 0 known vulnerabilities.
- Production preflight and operator-readiness diagnostics reported no blockers.
  The isolated backup/delete/restore/reopen drill and target-database integrity,
  foreign-key, relationship-guard, invariant, reconciliation, duplicate, and
  demo-marker checks passed.
- Playwright smoke tests passed at desktop and 390x844 with clean consoles,
  responsive Outreach controls and no horizontal overflow. Live bounded public
  discovery produced pending organization candidates; approval immediately
  created an 80/100 case match and shortlist status updated without a reload.
  Case intake also preserved an immediately closed draft, restored it after a
  full reload, created the case without a page refresh, and cleared the draft
  only after success.
  Existing command-center, Google-status, closable-dialog, and password-control
  checks also remain covered.
- The consolidated Evidence route was exercised at desktop and 390x844. It
  exposed case-scoped CSV and ZIP exports, downloaded a real CSV, disabled the
  unavailable PDF format, and kept batch scoring unavailable with a truthful
  collection prompt when the selected case contained no evidence.
- The CI Playwright/axe audit rendered all 15 supported static routes at
  1440x900 and 390x844. Serious/critical WCAG A/AA violations, unnamed visible
  controls, missing primary headings, page overflow, failed requests, page
  errors, and console errors all block the browser job.
- Packaged Electron scanner QA passed signup, shared-session authorization, empty-state rendering, disabled unsafe scan state, Settings navigation, and clean renderer console checks.
- A packaged launch from a directory containing hostile development `.env` values still reported production mode, database readiness, and a random `127.0.0.1` port.
- The current unsigned portable executable is 151,773,047 bytes with SHA-256
  `3d68bea313f916a1a9c635127d65336149615127a5af2277a830d85cfbe04ab0`.
  Windows reports `NotSigned`, as intended. An isolated-profile launch applied
  all six migrations, installed 228 database relationship guards, served the
  renderer, and returned healthy production status on automatically selected
  loopback port 63918. Packaged QA also verified signup,
  Google evidence controls, truthful Settings exports, responsive layout, and a
  clean browser console.
- PR #28 merged after the required Node and Python branch checks. Its protected-main
  baseline CI run `29715727941` passed; Windows workflow `29715727914` passed the gate,
  build, Electron ABI check, package, checksum, and upload stages.
- The protected-main `LARO-Desktop-Windows` workflow artifact was uploaded with
  SHA-256 digest
  `2f1a2878bf924d89a0e21ea69bbc109351a709afd8b90b4712a5c5d53bf9f4b7`.

Run the same checks locally:

```powershell
npm run gate
npm run test:a11y:browser
npm run readiness
npm run db:readiness
python -m unittest -v test_authentication test_document_intelligence test_google_oauth test_lawyer_matching test_legal_ledger test_outreach_targets
```

For a broader Flask regression run:

```powershell
python -m unittest discover -v -p "test_*.py"
```

The npm gate is fail-fast and blocks on server, Electron main-process, and renderer TypeScript checks, lint, traceability, safety scans, an isolated database recovery drill, and Vitest.

## Docker and Packaging

The Docker image compiles and runs the standalone Express/tRPC API server on Node 22. It does not contain the Electron UI or Flask Case Command Center.

```powershell
docker compose up --build
```

SQLite and local evidence persist in the `laro-data` volume. Health endpoints are available at `/api/live`, `/api/ready`, and `/api/health`.

Windows desktop packaging uses:

```powershell
npm run dist:win
```

LARO's supported local workflows are unmetered. There is no checkout, paid tier,
usage quota, or upgrade gate; persisted usage data is operational count telemetry
only.

The package includes only the two matcher datasets from `assets/`; the legacy
development service, Python cache files, and local configuration are excluded.
See [Backup and Restore](docs/BACKUP_RESTORE.md) for recovery-ready backup sets
that bind SQLite state to the key required to decrypt persisted provider tokens.

CI runs Node and Python gates for pushes and pull requests to `main`. The release
workflows target Node 22. Current Windows builds are unsigned artifacts; no Store
certification or paid signing provider is active. Tagged releases may also remain
unsigned when `WINDOWS_SIGNING_PROVIDER` is unset or set to `unsigned`, but the
external acceptance record must still be approved and Windows may show an
unknown-publisher warning. Optional Store and direct-signing routes remain available.

## Repository Map

| Path | Purpose |
| --- | --- |
| `src-main/` | Electron lifecycle, native integrations, scanner, and secure local secret bootstrap |
| `src/renderer/` | React desktop interface |
| `server/` | Express/tRPC API, Drizzle data layer, providers, matching, workflow, safety, and operations |
| `shared/` | Shared contracts and constants |
| `drizzle/` | Desktop/server SQLite migrations |
| `frontend/` | Flask command-center, evidence, timeline, Papertrail, and outreach pages |
| `app.py` | Flask routes and runtime orchestration |
| `legal_ledger.py` | Persistent legal ledger and source-linked case graph |
| `document_intelligence.py` | Deterministic extraction and review suggestions |
| `local_semantic_analysis.py` | Optional loopback local-model analysis |
| `lawyer_matching.py` | Flask legal-profile lawyer ranking |
| `outreach_target_matching.py` | Media and organization target ranking |
| `tests/` | TypeScript unit, integration, safety, accessibility, and smoke suites |
| `test_*.py` | Flask and legal-ledger unit/integration suites |
| `scripts/` | Setup, diagnostics, verification, traceability, safety, backup, and readiness tools |
| `docs/` | Architecture, operations, security, privacy, provider, and audit documentation |

## Known Limitations

- The Electron and Flask runtimes currently use separate schemas and databases; changes in one do not automatically appear in the other.
- Legacy prototype files remain in `frontend/` and `docs/` for traceability. Only the entry points documented above are supported runtime surfaces; historical snapshots must not be treated as current behavior.
- Several provider integrations are optional or partial and remain unavailable until valid credentials and user OAuth consent are present. Trello OAuth is intentionally disabled until server-side token storage is implemented.
- Outreach target discovery is a review aid, not a complete or continuously verified directory of every lawyer, journalist, program, lobby, or advocacy organization.
- Real external sending is intentionally disabled by default and should remain disabled until the target environment, provider, approval UI, emergency stop, and audit trail have been reviewed.
- The current lockfile audits cleanly; run `npm run audit:deps` again for every release because registry advisories change over time.
- Dashboard routes are loaded on demand. The production entry chunk is about 274 KB before gzip (85 KB gzip); the largest route chunk is about 230 KB before gzip.
- The internal portable Windows artifact is not Authenticode-signed and must not be distributed as a trusted public installer. No Store or paid-certificate route is currently active; Windows may display an unknown-publisher warning for internal builds.
- Historical phase and verification documents in `docs/` are dated snapshots. Prefer current code, tests, this README, and a fresh `npm run gate` when status statements differ.

## Further Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [User Guide](docs/USER_GUIDE.md)
- [Operator Runbook](docs/OPERATOR_RUNBOOK.md)
- [Provider Reality Review](docs/PROVIDERS.md)
- [Legacy Dashboard Port Audit](docs/LEGACY_DASHBOARD_PORT_AUDIT.md)
- [Feature Flags](docs/FEATURE_FLAGS.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Backup and Restore](docs/BACKUP_RESTORE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Technical Debt](docs/TECH_DEBT.md)
- [Changelog](CHANGELOG.md)

## License

See [LICENSE](LICENSE).
