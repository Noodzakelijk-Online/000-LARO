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
- Deduplicate imported evidence while preserving source URIs and locally retrievable files.

### Document intelligence and Papertrail

- Extract readable text and create review-only suggestions for events, claims, evidence links, contradictions, deadlines, obligations, and missing evidence.
- Run full-source deterministic comparisons or optional loopback-only Ollama analysis in bounded batches.
- Reject uncited model observations; retained suggestions include literal source support and remain unconfirmed until reviewed.
- Build who-said-or-did-what-and-when timelines with actor, action, affected party, event type, date, summary, and direct document access.
- Browse evidence as story, horizontal timeline, vertical timeline, or filtered Papertrail views.
- Generate source-linked case summaries, lawyer briefings, red-line drafts, and approval-bound case bundles.

### Matching and outreach

- Rank lawyers using the case's legal fields and available directory attributes instead of returning random demo matches.
- Match media and organizations as separate outreach categories and maintain a reviewable target directory.
- Discover and import candidate targets from configured/public sources; discovery does not claim exhaustive internet coverage and requires human review.
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

`npm run setup` creates `.env` from `.env.example` only when `.env` does not already exist. It never overwrites existing configuration. The packaged desktop app generates local JWT, cookie, and local-agent secrets in its Electron user-data directory; standalone production server operation requires strong values in `.env`.

Useful desktop commands:

```powershell
npm run dev:server       # Express/tRPC API only, port 3000
npm run doctor           # environment and native-module checks
npm test                 # Vitest suite
npm run gate             # blocking quality and safety gates
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
| Desktop server | `NODE_ENV`, `HOST`, `PORT`, `API_BODY_LIMIT`, `JWT_SECRET`, `COOKIE_SECRET`, `LOCAL_AGENT_TOKEN` |
| Desktop data | `DATABASE_URL`, `LOCAL_STORAGE_DIR`, `AWS_S3_*` |
| Provider-backed desktop AI | `FORGE_API_URL`, `FORGE_API_KEY` |
| Optional connectors | `MICROSOFT_*`, `TELEGRAM_BOT_TOKEN`, `SENDGRID_API_KEY`, `SMTP_*` |
| Flask server | `LARO_FLASK_PORT`, `LARO_HOST`, `LARO_DEBUG`, `SECRET_KEY` |
| Flask ledger | `LARO_LEDGER_DATABASE_URL`, `LARO_UPLOAD_ROOT`, `LARO_MAX_UPLOAD_BYTES`, `LARO_BUNDLE_MAX_BYTES` |
| Flask local identity and vault | `LARO_LOCAL_ACCOUNT_EMAIL`, `LARO_TOKEN_STORE_DIR`, `LARO_TOKEN_ENCRYPTION_KEY` |
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

## Review and Safety Model

- Extracted events and legal observations are suggestions, not confirmed facts.
- Every retained AI observation must cite source text; uncited model output is discarded.
- Case ownership is enforced on authenticated case, document, approval, audit, and matching routes.
- Approving a draft does not send it.
- Desktop outreach send is off by default through `outreach.send.enabled` and is overridden by the global emergency stop.
- A failed or missing email provider does not produce a false `Sent` state.
- Bundle approval is tied to the exact persisted case snapshot. Later evidence, analysis, outreach, draft, or case changes invalidate that approval.
- Bundle manifests include SHA-256 digests and omit credential-shaped fields and machine-local paths from structured exports.

See [Operator Runbook](docs/OPERATOR_RUNBOOK.md), [Security](docs/SECURITY.md), [Privacy](docs/PRIVACY.md), and [Threat Model](docs/THREAT_MODEL.md) before operating with real case data.

## Verification

The production-readiness branch was verified on 2026-07-13 against the Node 22 toolchain:

- `npm run gate`: all blocking gates passed.
- Server and Electron main-process TypeScript checks passed.
- Traceability reported 116 rows, 93 cited, and 0 broken references.
- Runtime no-excuses scan reported 0 suspect findings; account safety reported 0 high-severity findings.
- Vitest reported 29 passing files, 190 passing tests, and 9 explicit todos.
- The affected Python integration suites reported 92 passing tests.
- Full Python test discovery reported 196 passing tests.
- The Vite 8 renderer, Electron 43 main process, and standalone server builds completed successfully.
- `npm audit` reported 0 known vulnerabilities.
- A clean Node 22 Docker build reached healthy readiness with its persistent SQLite volume.
- The Electron 43 SQLite native binding smoke test and Windows portable packaging completed successfully.

Run the same checks locally:

```powershell
npm run gate
python -m unittest -v test_document_intelligence test_google_oauth test_lawyer_matching test_legal_ledger test_outreach_targets
```

For a broader Flask regression run:

```powershell
python -m unittest discover -v -p "test_*.py"
```

The npm gate is fail-fast and blocks on server and Electron main-process TypeScript checks, traceability, safety scans, and Vitest. The dedicated renderer compiler remains a non-blocking diagnostic while its historical API-contract backlog is consolidated.

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

CI runs Node and Python gates for pushes and pull requests to `main`. The release workflow targets Node 22 and publishes a Windows portable artifact without writing provider secrets into the build workspace.

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
- The dedicated React renderer TypeScript configuration still reports historical API-contract debt and is non-blocking in `npm run gate`; Vite production builds remain blocking.
- Several provider integrations are optional or partial and remain unavailable until valid credentials and user OAuth consent are present. Trello OAuth is intentionally disabled until server-side token storage is implemented.
- Outreach target discovery is a review aid, not a complete or continuously verified directory of every lawyer, journalist, program, lobby, or advocacy organization.
- Real external sending is intentionally disabled by default and should remain disabled until the target environment, provider, approval UI, emergency stop, and audit trail have been reviewed.
- The current lockfile audits cleanly; run `npm run audit:deps` again for every release because registry advisories change over time.
- The production renderer bundle is about 1.70 MB before gzip and should be split further to improve startup performance; its broader pre-existing TypeScript contract debt also needs a dedicated consolidation pass.
- The Windows portable artifact is not Authenticode-signed and still uses Electron's default icon. A trusted signing certificate and approved application icon are prerequisites for public distribution.
- Historical phase and verification documents in `docs/` are dated snapshots. Prefer current code, tests, this README, and a fresh `npm run gate` when status statements differ.

## Further Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [User Guide](docs/USER_GUIDE.md)
- [Operator Runbook](docs/OPERATOR_RUNBOOK.md)
- [Provider Reality Review](docs/PROVIDERS.md)
- [Feature Flags](docs/FEATURE_FLAGS.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Backup and Restore](docs/BACKUP_RESTORE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Technical Debt](docs/TECH_DEBT.md)
- [Changelog](CHANGELOG.md)

## License

See [LICENSE](LICENSE).
