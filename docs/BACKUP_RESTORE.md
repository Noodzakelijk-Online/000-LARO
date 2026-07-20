# Backup and Restore

LARO stores application state in SQLite. Persisted provider tokens are encrypted
with `JWT_SECRET`, so a database is not recovery-ready unless the matching key is
also available. The server path is `DATABASE_URL`; the desktop application uses
`<userData>/laro-server.sqlite` and keeps its generated keys in
`<userData>/laro-secrets.json`.

## Backup

```powershell
npm run db:backup
npm run db:backup -- C:\Backups\laro.sqlite
```

The command uses SQLite's online backup API, then requires `PRAGMA quick_check`,
a clean foreign-key check, and the minimum LARO schema. It publishes a backup set
only after every member is complete:

- `<backup>`: the verified SQLite database;
- `<backup>.manifest.json`: database size/hash and encryption compatibility;
- `<backup>.secrets.json`: the matching desktop keys, when a valid
  `laro-secrets.json` exists beside `DATABASE_URL`.

The manifest is renamed into place last and acts as the completion marker. LARO
refuses to overwrite an existing set. For a standalone server whose key comes
from `JWT_SECRET`, no secret sidecar is written; the manifest instead contains a
non-reversible compatibility tag and validation requires the matching
environment secret. Use `--desktop-secrets <path>` or
`LARO_DESKTOP_SECRETS_PATH` when desktop keys are not beside the database.

The default destination is a timestamped file under `db-backups` beside the live
database. Keep every set member together on access-controlled or encrypted
storage. The desktop sidecar contains secret key material.

## Validate

```powershell
npm run db:validate -- C:\Backups\laro.sqlite
```

Validation is read-only. For a backup set it verifies the manifest, filenames,
sizes, SHA-256 hashes, SQLite integrity, foreign keys, core schema, and encryption
key compatibility. A database-only backup from an older LARO version can still
be checked structurally, but the command labels it as legacy because token
decryptability cannot be proven.

## Restore

1. Stop incoming API traffic or close LARO Desktop.
2. Validate the selected backup.
3. Restore it:

```powershell
npm run db:restore -- C:\Backups\laro.sqlite
```

Restore verifies the complete set before changing live state. For desktop sets it
stages the bundled key file first, preserves the current key file, restores the
database, and rolls the key file back if database restoration fails. The previous
database and previous keys remain beside their live paths with `.bak-<timestamp>`
suffixes. The next request or desktop launch reopens the restored database.

A legacy database-only restore is blocked by default. After separately proving
that the correct historical key is installed, an operator can accept that risk
explicitly:

```powershell
npm run db:restore -- C:\Backups\legacy.sqlite --allow-legacy
```

## Recovery Proof

```powershell
npm run recovery:drill
```

The drill creates an isolated migrated database and desktop key file, writes a
marker, creates a verified backup set, changes both live files, restores the set,
and proves marker/key recovery plus preservation of both previous files. It never
touches the live profile. `npm run readiness` includes this drill as a required
check.
