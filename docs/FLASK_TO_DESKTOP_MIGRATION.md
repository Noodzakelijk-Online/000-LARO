# Flask To Desktop Migration

Updated: 2026-07-21

Electron is LARO's production runtime. The Flask command center remains in the
repository so an existing local ledger can be reviewed, backed up, and migrated
without discarding its source-linked records. It is not a second concurrent
production authority after migration.

## Safety Contract

The migration is offline and one-way:

- both Flask and LARO Desktop must be stopped during `--apply`;
- the Flask ledger is opened read-only;
- source and target owner emails must match unless the operator explicitly uses
  `--allow-identity-remap` after reviewing the ownership change;
- dry-run is the default and writes nothing;
- target writes use one SQLite transaction and deterministic IDs;
- an integrity-checked target database snapshot is created before writes;
- local source files must resolve inside the declared Flask upload root;
- copied bytes are verified against the ledger SHA-256 when one is present and
  are re-hashed after copying;
- a failed apply removes files created by that attempt and rolls back SQLite;
- re-running an unchanged source is a no-op, while a changed source is rejected
  for the same source ID;
- password hashes, browser sessions, OAuth vault credentials, and provider
  secrets are not migrated.

Create and validate complete Electron and Flask recovery sets before applying a
migration. The automatic database snapshot is an additional guard, not a
replacement for the complete database/key/evidence and ledger/auth/vault/upload
recovery sets.

## Data Mapping

The migration makes these records operational in Electron:

| Flask record | Desktop record |
| --- | --- |
| `legal_cases` | `cases` |
| `case_documents` | `evidence` plus managed local storage when bytes are available |
| `case_events` | `timeline` |
| `deadlines` | `deadlines` |
| `legal_claims` | reviewable `legal_inferences` data |
| `contradictions` | reviewable `suspicious_patterns` data |
| `missing_evidence_warnings` | reviewable `expected_documents` data |

Every owner-scoped source row, including entities without a safe one-to-one
desktop mapping, is retained in `legacy_import_records`. Stored payloads are
hash-addressed and credential-shaped fields are redacted. Actionable Flask
drafts, approvals, outreach, and responses remain archive records instead of
being inserted into live send queues. Global Flask directory rows are excluded
because they are not owner records and current directories have their own
review/provenance lifecycle.

Migration history is visible under **Settings > Security > Legacy workspace
imports**. The archive tables carry `userId`, so account export and erasure
include them automatically.

## Procedure

1. Stop Flask, its workers, and LARO Desktop.
2. Create and validate both complete recovery sets.
3. Start LARO Desktop once on the current build, create or confirm the target
   account, then close it. This applies the archive schema migration.
4. Run a dry-run from the repository root.

```powershell
npm run flask:migrate-to-desktop -- `
  --source-db C:\LARO\instance\laro_ledger.sqlite3 `
  --target-db "$env:APPDATA\laro-desktop\laro-server.sqlite" `
  --source-email owner@example.nl `
  --target-email owner@example.nl `
  --source-id workstation-20260721 `
  --source-upload-root C:\LARO\uploads `
  --target-storage-root "$env:APPDATA\laro-desktop\uploads"
```

Confirm that the dry-run reports the expected owner, cases, archive rows, file
count, snapshot hash, and no file issues. Paths vary by Electron installation;
use the actual `<userData>` database and upload paths recorded by the target
installation rather than assuming the example path.

5. Repeat the reviewed command with `--apply`.
6. Open Desktop and verify the imported cases, evidence downloads, timeline,
   deadlines, and Settings migration history.
7. Run `npm run db:readiness`, create a new complete Electron recovery set, and
   keep the original Flask recovery set as the immutable migration source.
8. Leave Flask stopped. Do not continue editing both copies.

If a source file is intentionally unavailable, the operator may use
`--allow-missing-files`. The run and affected evidence are visibly marked with
the missing count; this flag must not be used to make an unexplained file error
look successful. If owner emails legitimately changed, use
`--allow-identity-remap` only after independently confirming both identities.

## Rollback

For an apply failure, the script rolls back its SQLite transaction and removes
newly copied files. For a completed migration that must be reversed, stop the
desktop runtime and restore the complete pre-migration Electron recovery set by
following [Backup and Restore](BACKUP_RESTORE.md). Do not replace only the
database, because that can leave migrated evidence bytes without matching
metadata. The source Flask recovery set remains unchanged throughout.
