# Data Model, Ownership, and Persistence

Current as of 2026-07-15.

## Topology

- `laro-server.sqlite`: canonical Electron/Express application data through
  Drizzle ORM.
- `laro-agent.db`: ephemeral desktop scanner progress and review state through
  prepared SQLite statements.
- Managed evidence bytes: AWS S3 when configured, otherwise the Electron
  user-data upload directory.
- The optional Flask command-center runtime retains a separate ledger database;
  it does not silently share Electron records.

Both SQLite connections enable WAL, foreign-key enforcement, and a 5-second busy
timeout. The scanner database declares its scan-to-file foreign key.

## Ownership

- User-owned rows carry `userId` and are filtered by the authenticated user.
- Case-scoped operations call `assertCaseOwnership`.
- Lawyer directory rows are global reference data; private case/outreach records
  remain owner-scoped.
- Scanner uploads use a short-lived token for the signed-in user and pass through
  the same evidence ownership guard as manual uploads.

## Integrity

- User email and case/lawyer outreach pairs have unique indexes.
- Evidence storage keys and filenames are sanitized and confined.
- Evidence bytes produce SHA-256 provenance stored in metadata and projected as
  `contentHash` / `hashAlgo` on reads.
- Storage is deleted if evidence-record creation fails.
- Reconciliation and invariant reports detect orphan or inconsistent records.
- Backup validation and an isolated delete/restore/reopen drill are release
  gates.

## Remaining model work

Many relationships are still application-enforced rather than declared as SQL
foreign keys. Adding constraints requires a reviewed migration after reconciling
existing installations. Some historical money and count fields remain text and
should be normalized through the same migration discipline.
