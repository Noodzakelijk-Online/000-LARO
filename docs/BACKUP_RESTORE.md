# Backup and Restore

LARO stores application metadata in SQLite, provider tokens under an encryption
key, and evidence bytes on local disk or S3. A database alone is therefore not a
complete recovery point. The server path is `DATABASE_URL`; the desktop uses
`<userData>/laro-server.sqlite`, `<userData>/laro-secrets.json`, and
`<userData>/uploads`.

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
  `laro-secrets.json` exists beside `DATABASE_URL`;
- `<backup>.files/`: every file from local managed storage, with per-file size
  and SHA-256 inventory in the manifest.

The manifest is renamed into place last and acts as the completion marker. LARO
refuses to overwrite an existing set. For a standalone server whose key comes
from `JWT_SECRET`, no secret sidecar is written; the manifest instead contains a
non-reversible compatibility tag and validation requires the matching
environment secret. Use `--desktop-secrets <path>` or
`LARO_DESKTOP_SECRETS_PATH` when desktop keys are not beside the database. Use
`--local-storage <path>` or `LARO_LOCAL_STORAGE_PATH` for a nonstandard evidence
root.

For local storage, LARO copies and hashes every regular file, rejects symbolic
links and unsafe paths, verifies that every database-managed storage key exists,
then rescans the source after the SQLite snapshot. Any addition, removal, or byte
change aborts publication. When `AWS_S3_BUCKET` is configured, remote objects are
not copied; the manifest records the bucket, region, and database-derived key
inventory. S3 versioning/replication remains an external operational requirement.

The default destination is a timestamped file under `db-backups` beside the live
database. Keep every set member together on access-controlled or encrypted
storage. The desktop sidecar contains secret key material.

## Validate

```powershell
npm run db:validate -- C:\Backups\laro.sqlite
```

Validation is read-only. For a backup set it verifies the manifest, filenames,
sizes, SHA-256 hashes, SQLite integrity, foreign keys, core schema, encryption
key compatibility, and local-file or S3-key coverage. A database-only backup is
labelled legacy because token and file recovery cannot be proven. A version-1
backup set can still be inspected, but is labelled as missing storage coverage.

## Restore

1. Stop incoming API traffic or close LARO Desktop.
2. Validate the selected backup.
3. Restore it:

```powershell
npm run db:restore -- C:\Backups\laro.sqlite
```

Restore verifies the complete set before changing live state. For desktop sets it
stages the bundled keys and evidence directory, preserves all current paths, and
then restores SQLite. A database failure independently rolls back storage and
keys; an incomplete rollback is reported as a maintenance error. Previous state
remains beside each live path with a `.bak-<timestamp>` suffix.

An S3-backed set restores only when the active bucket and region exactly match
the manifest. It never claims to have copied or restored remote objects.

A legacy database-only restore is blocked by default. After separately proving
that the correct historical key is installed, an operator can accept that risk
explicitly:

```powershell
npm run db:restore -- C:\Backups\legacy.sqlite --allow-legacy
```

A version-1 set without evidence coverage is also blocked. Only after separately
restoring the matching local evidence may an operator use:

```powershell
npm run db:restore -- C:\Backups\v1.sqlite --allow-missing-storage
```

## Recovery Proof

```powershell
npm run recovery:drill
```

The drill creates an isolated migrated database, key file, and referenced legal
evidence object; changes all three live states; restores the set; and proves data,
key, and evidence recovery plus preservation of every previous path. It never
touches the live profile. `npm run readiness` includes this drill.

## Runtime Scope

This CLI covers the Electron/Express/tRPC database and its managed storage. The
separate Flask Case Command Center still has its own ledger, auth database, token
vault, and upload root; these require a separate coordinated snapshot until a
verified Flask recovery command is implemented.
