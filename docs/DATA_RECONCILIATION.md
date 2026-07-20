# Data Reconciliation & Repair

Updated: 2026-07-20

Recent tables use declared SQLite foreign keys. Historical tables cannot gain
foreign keys without destructive table rebuilds, so database startup installs
equivalent insert, update, and parent-delete triggers for case, user, account,
lawyer, settings, file-tag, and conversation relationships. Existing rows are
not silently changed when those guards are installed.

`server/reconcile.ts` detects historical drift across the same relationship
registry and supports an explicit transactional repair.

## Detect (read-only)
`reconcileReport()` returns:
- `orphanedByCaseId` — child rows whose `caseId` has no matching case,
- `orphanedByUserId` — rows whose `userId` has no matching user,
- `orphanedByRelationship` — every broken guarded relationship, keyed as
  `child.column->parent.column`,
- `duplicateEmails` — users sharing an email (should be none post-Phase-005),
- `totalOrphans`.

## Repair
`repairOrphans()` deletes orphaned rows inside a transaction and returns per-table
and column counts. It only removes rows whose referenced parent is absent. Create
and validate a backup before repairing a real target database.

## Verification
`tests/backend/relationshipIntegrity.backend.test.ts` verifies guard installation,
insert/update rejection, parent-delete cascading, non-destructive startup over a
legacy orphan, relationship reporting, and explicit repair. Production readiness
also fails closed when a required trigger is missing.
