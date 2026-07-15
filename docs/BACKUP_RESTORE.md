# Backup and Restore

LARO stores application state in SQLite. The server path is `DATABASE_URL`; the
desktop application uses `<userData>/laro-server.sqlite`.

## Backup

```powershell
npm run db:backup
npm run db:backup -- C:\Backups\laro.sqlite
```

The command uses SQLite's online backup API, then requires `PRAGMA quick_check`,
a clean foreign-key check, and the minimum LARO schema before reporting success.
The default destination is a timestamped file under `db-backups` beside the live
database.

## Validate

```powershell
npm run db:validate -- C:\Backups\laro.sqlite
```

Validation is read-only. A file that is corrupt, violates foreign keys, or lacks
core LARO tables is rejected.

## Restore

1. Stop incoming API traffic or close LARO Desktop.
2. Validate the selected backup.
3. Restore it:

```powershell
npm run db:restore -- C:\Backups\laro.sqlite
```

Restore copies and validates a staged file in the live database directory,
checkpoints and closes the current SQLite connection, moves the previous database
to `laro-server.sqlite.bak-<timestamp>`, and then installs the staged file. A
failed replacement attempts to move the previous database back into place. The
next request or desktop launch reopens the restored database.

## Recovery Proof

```powershell
npm run recovery:drill
```

The drill creates an isolated migrated database, writes a marker, performs a
verified backup, deletes the marker, restores the backup, and proves both marker
recovery and preservation of the previous database. It never touches the live DB.
`npm run readiness` includes this drill as a required check.
