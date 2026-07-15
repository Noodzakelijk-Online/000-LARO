# Operator Runbook

## Health and Diagnostics

- Liveness: `GET /api/live`
- Database readiness: `GET /api/ready`
- Full health: `GET /api/health`
- Local diagnostics: `npm run doctor`
- Admin diagnostics: `admin.diagnostics`, `admin.tableCounts`, `admin.invariants`

Background jobs run in the server process. `health.readiness` reports database
and job state, including the last run, success, and error timestamps.

## Safety Controls

- Engage `admin.setEmergencyStop` before investigating unsafe outreach behavior.
- Keep `outreach.send.enabled=false` unless real delivery is intentionally live.
- Every send still requires ownership, approval, idempotency, provider, and audit
  checks. The feature flag alone does not bypass them.
- Rate limits are process-local; deploy a single API replica unless a shared
  limiter is introduced.

## Data Operations

- Integrity: `admin.invariants`
- Read-only orphan report: `admin.reconcileReport`
- Explicit orphan repair: `admin.repairOrphans`
- Backup, validation, restore, and drill: see `docs/BACKUP_RESTORE.md`
- Retention preview/run: `admin.retentionPreview`, then `admin.retentionRun`

## Incident Sequence

1. Stop risky behavior with the emergency stop.
2. Preserve logs and create a verified backup.
3. Run health, invariant, and reconciliation reports.
4. Rotate compromised secrets and revoke affected sessions or provider tokens.
5. Roll back application and database only when evidence requires it.
6. Re-run readiness and the critical acceptance flow before reopening.

Deleting `<userData>/laro-secrets.json` rotates desktop session secrets on the
next launch and invalidates existing sessions. Provider credentials require
their own rotation or revocation at the provider.
