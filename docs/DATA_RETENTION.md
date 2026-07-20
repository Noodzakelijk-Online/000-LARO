# Data Retention and Archival Policy

Updated: 2026-07-20

## Policy

| Data | Retention | Action at expiry |
| --- | --- | --- |
| Audit logs (`audit_logs`) | `AUDIT_RETENTION_DAYS` (default 365) | Delete expired rows |
| User business data | Account lifetime | Owner-controlled export and erasure |

Audit logs can contain identifying metadata and should not accumulate
indefinitely. Cases, evidence, and outreach belong to the account owner and are
never removed by the audit-retention sweep.

## Execution

- The sweep runs once after server startup to catch up after downtime.
- It then runs daily at 03:30 through the observable job runner.
- `admin.retentionPreview` reports what would be deleted without changing data.
- `admin.retentionRun` executes an additional operator-requested sweep and writes
  an audit entry with the report.
- Repeated execution is safe and is a no-op when no row has expired.

## Configuration safety

`AUDIT_RETENTION_DAYS` accepts whole numbers from 30 through 3650. Invalid,
fractional, zero, negative, or out-of-range values stop startup rather than
risk an unsafe cutoff. The default is 365 days.

## Verification

Automated tests prove that the sweep removes only expired audit rows, retains
recent audit rows and business data, rejects unsafe configuration, and keeps a
dedicated daily schedule separate from evidence collection.
