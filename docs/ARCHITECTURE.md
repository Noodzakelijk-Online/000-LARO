# LARO Architecture

Updated: 2026-07-20

LARO contains two supported local-first runtimes. They share a repository and selected provider configuration, but they currently have separate schemas and databases. This is an explicit transitional constraint, not an implied synchronization mechanism.

## Runtime Map

| Runtime | Responsibility | Entry point | Persistence |
| --- | --- | --- | --- |
| Electron + Express/tRPC + React | Desktop case workflows, provider connections, evidence storage, matching, controlled outreach, and administration | `src-main/index.ts`, `server/index.ts`, `src/renderer/main.tsx` | Drizzle over SQLite plus local disk or S3 evidence storage |
| Flask Case Command Center | Legal ledger, document intelligence, source-linked timelines, Papertrail, bundles, matching, and outreach preparation | `app.py`, `legal_ledger.py`, `frontend/` | SQLAlchemy over SQLite plus local uploads, auth database, and encrypted token vault |

The Electron process starts the Express/tRPC API and React renderer together. The same API can run standalone through `npm run dev:server` or Docker. The Flask runtime binds to loopback by default on port 8768 so both runtimes can operate concurrently.

## Desktop Flow

```text
Electron main process
  -> generates or loads per-install secrets
  -> initializes SQLite migrations and integrity checks
  -> starts Express/tRPC on loopback
  -> loads the Vite-built React renderer
  -> renderer calls /api/trpc with an HTTP-only session cookie
```

Important boundaries:

- tRPC procedures enforce authentication, role checks, case ownership, and team access.
- Provider credentials stay server-side and are encrypted at rest.
- Evidence blobs use S3 when configured or confined local storage with SHA-256 provenance hashes.
- Supported evidence is extracted locally into versioned, persisted document
  analyses. Deterministic findings carry source-span IDs; optional provider
  enrichment is discarded when any finding cites an unknown source span.
- Gmail messages, attachments, local files, and Drive files use the same managed
  evidence storage. Google-native documents are exported to PDF before analysis.
- Desktop Outreach consolidates analytics, the official NOvA lawyer directory,
  and owner-scoped media/organization directories. Public discovery is bounded,
  sends legal-area terms rather than case prose, and persists candidates behind
  an explicit review gate before local case matching.
- External outreach is disabled by default and requires ownership, approval, feature-flag, emergency-stop, provider, and idempotency checks.
- Server, Electron main, renderer TypeScript, ESLint, safety scans, traceability,
  an isolated database/key/evidence backup-set recovery drill, and Vitest are
  blocking release gates.

## Flask Flow

```text
Flask app
  -> authenticates the configured local owner or a password account
  -> scopes ledger calls to the authenticated external user id
  -> stores cases and review state in the legal ledger
  -> stores uploaded evidence under the configured local root
  -> stores OAuth credentials only in the encrypted local token vault
  -> renders the command-center HTML clients
```

Important boundaries:

- Password users and hashed bearer sessions persist in `LARO_AUTH_DATABASE_PATH`; no sample users are seeded.
- The loopback session bootstrap accepts only `LARO_LOCAL_ACCOUNT_EMAIL` and is rejected for non-loopback requests.
- Google OAuth status requires authentication. Start and callback state are bound to the authenticated Flask session, and return paths are local-only.
- Ledger case routes use one centralized ownership check before reading or mutating legal material.
- Document analysis produces review suggestions. It does not silently promote model output into confirmed facts.
- Case-bundle approval is tied to the exact persisted case snapshot and becomes stale when relevant state changes.
- Flask recovery sets coordinate the ledger SQLite file, authentication SQLite
  file, encrypted OAuth vault, and upload root. External secret values remain in
  operator escrow and are verified through non-reversible compatibility tags.
- The Flask recovery drill is blocking alongside the Electron database/key/
  evidence drill; the two recovery-set formats remain intentionally separate.

## Data Ownership

The desktop and Flask schemas are not automatically synchronized. A case created in one runtime is not guaranteed to appear in the other. Until a reviewed migration or replication contract exists, operators must treat each runtime as authoritative only for its documented workflows.

Private records are scoped as follows:

- Desktop cases, evidence, documents, communications, inbox threads, sync jobs,
  media/organization targets, case-target matches, and search results are user-
  or case-owner scoped.
- Global lawyer directory data can be read for matching, while lawyer mutation is administrative.
- Flask ledger records are keyed to the authenticated external user identity.
- API responses never include encrypted access or refresh token ciphertext.

## Providers and AI

- Google and Microsoft OAuth require configured client credentials and explicit user consent.
- Trello OAuth remains disabled until its server-side token lifecycle is complete.
- Desktop document analysis retains a deterministic local result when provider
  credentials are absent; provider-backed enrichment fails closed and cannot
  replace the source-grounded result with uncited output.
- Flask document intelligence always has a deterministic review path and can optionally use a loopback-only Ollama endpoint.
- Model-derived observations must contain literal source support and remain unconfirmed until reviewed.

## Deployment Model

- Electron is the primary desktop distribution target.
- Docker packages only the standalone Express/tRPC API, not Electron or Flask.
- Flask is a separate local process launched by `run_local.ps1`.
- SQLite files, uploads, token vaults, and generated secrets are runtime state and are ignored by Git.
- Desktop packaging allowlists the two matcher datasets and excludes the legacy
  development service under `assets`.
- Current Windows artifacts are unsigned portable builds. Signing is optional:
  internal distribution can proceed with the normal Windows publisher warning,
  while Store or Authenticode signing can be added later without changing the runtime.

## Current Architectural Risks

1. The two runtimes can drift because they do not share a database or generated cross-runtime contract.
2. Several old prototype HTML and documentation files remain for traceability and are not supported entry points.
3. Some desktop schema fields still store numeric values as text and need reviewed migrations.
4. Database integrity remains partly application-enforced; additional foreign keys require migration planning.
5. The renderer bundle should be split further to improve startup performance.

Use current code, `README.md`, `docs/SECURITY.md`, and fresh gate output as status authority. Historical phase reports are snapshots, not release evidence.
