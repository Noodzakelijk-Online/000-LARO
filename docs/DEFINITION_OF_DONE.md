# Feature-Level Definition of Done

Current as of 2026-07-21.

A feature is done only when all applicable conditions hold:

1. A real backend or local implementation exists; unsupported behavior fails
   explicitly instead of returning fabricated success.
2. User data is authenticated and owner-scoped; administrative behavior is
   role-gated.
3. Inputs and state transitions are validated.
4. Real database-backed tests cover the happy path and a failure or
   authorization path.
5. The UI action reaches the supported implementation and exposes honest empty,
   loading, error, and disabled states.
6. The blocking gate passes.
7. Provider-dependent behavior has target-account evidence before that provider
   is enabled in production.

## Current Core Features

| Feature | Repository status | Target-environment condition |
| --- | --- | --- |
| Authentication and sessions | Done | Strong standalone secrets or generated desktop secrets |
| Case intake, draft autosave, CRUD, and classification | Done | Target database passes data-readiness checks |
| Evidence storage and document intelligence | Done | Optional model provider must pass live acceptance before enrichment is enabled |
| Source-linked timelines and exports | Done | Operator validates a representative target export |
| Official NOvA lawyer matching | Done | Public directory remains reachable |
| Media and organization discovery and matching | Done | Candidates remain review-gated; discovery is bounded, not exhaustive |
| Outreach preparation and approval | Done | None; preparation and approval never send |
| Outreach delivery | Done and disabled by default | Real provider, explicit approval, released emergency stop, enabled flag, ownership, audit, and idempotency |
| Response tracking and analytics | Done | Enabled inbound provider must pass live threading acceptance |
| Evidence, case, and account managed-object erasure | Done | Target backup, storage credentials, and retention policy reviewed |
| Scanner | Done | Clean-profile native folder and byte/hash acceptance |
| Operator diagnostics and recovery | Done for production and legacy migration source | Electron database/key/evidence and Flask ledger/auth/vault/upload drills pass; target backups and external secrets must still be escrowed and validated |
| Legacy Flask retirement | Done | Dry-run and owner-bound apply preserve source hashes, archive unmapped rows, verify copied evidence, and leave Electron authoritative |
| Local usage telemetry | Done | Counts operations and quantities only; never prices, quotas, or blocks core actions |

## Release Boundary

The supported current distribution is an internally distributed unsigned
Windows portable executable. Trusted public Windows distribution is a separate
target and requires Store or Authenticode acceptance. Optional providers that
have no target credentials remain visibly unavailable and do not block local
case, evidence, timeline, matching, review, or export workflows.

Low-risk follow-up work is tracked in [TECH_DEBT.md](TECH_DEBT.md). Historical
phase snapshots do not override current code, tests, this document, or a fresh
release gate.
