# Database Migrations & Rollback Safety (Phase 033)

Date: 2026-07-06 · Branch `Phase-Imp`

## How migrations run

- Migrations live in reviewed `drizzle/*.sql` files with bookkeeping
  in `drizzle/meta/_journal.json`.
- They apply automatically on first DB open (`server/db.ts:getDb`): drizzle's
  `migrate()` runs, and a homegrown recovery replay re-applies SQL idempotently
  if core tables are missing (portable-build safety). Missing schema columns are
  backfilled at boot (`ensureAllTablesColumns`), and integrity indexes are
  ensured (`ensureIndexes`, Phase 005/017).
- `ensureRelationshipIntegrityTriggers` installs non-destructive database guards
  for historical relationships after schema alignment. It rejects new orphaned
  inserts/updates and cascades parent deletion. It does not delete pre-existing
  drift; `admin.reconcileReport` and a reviewed `admin.repairOrphans` run handle
  that explicitly.

## Rollback strategy — file snapshot

SQLite has no automatic down-migrations, so rollback is a **file snapshot**:
take a backup **before** changing the schema, restore it if a migration fails.

```bash
# Back up (writes to <db-dir>/db-backups/…):
npm run db:backup                 # uses DATABASE_URL, else ./laro.sqlite

# Validate and restore a backup while the application is stopped:
npm run db:validate -- "<path-to>.bak"
npm run db:restore -- "<path-to>.bak"
```

The online SQLite backup includes committed WAL state in one consistent file.
Restore stages and validates the replacement and preserves the previous database.

## Recommended flow for a schema change

1. `npm run db:backup` (snapshot).
2. Update `server/schema.ts` and add a reviewed SQL migration, or add an idempotent boot-time step for a narrowly scoped compatibility repair.
3. Deploy; migrations apply on next boot.
4. If something is wrong, restore the snapshot with `--restore`.

## Known constraints (tracked)

- Migration `0001` performs destructive table rebuilds; the recovery replay only
  runs it when core tables are missing (never on a healthy live DB).
- A consolidated, non-destructive migration baseline is planned (Phase 033
  follow-up) to replace the boot-time reconciliation with clean versioned
  migrations.
- Historical tables retain trigger-enforced relationships until a future
  backup-tested rebuild can replace them with native foreign-key clauses.
