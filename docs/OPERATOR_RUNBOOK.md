# Operator Runbook — 000-LARO

Date: 2026-07-06 · Branch `Phase-Imp`

Operational reference. This is a **partial** runbook focused on the areas made
real so far (background jobs, rate limits, idempotency, audit). It grows as later
phases land.

---

## 1. Background jobs (Phase 016)

Jobs run inside the in-process server (`server/cronScheduler.ts`), started on
server listen via `initCronScheduler()`.

| Job | Schedule | What it does | Retry |
|---|---|---|---|
| `auto-collection` | daily 02:00 | Pull evidence for all cases from connected sources | 2 (exp backoff) |
| `outreach-heartbeat` | hourly | **Heartbeat only** — logs that automated outreach follow-ups are disabled until the send path + approval gate exist (Phase 026). Sends nothing. | 0 |

- Every job runs through `runJob()`, which isolates errors (a failing job never
  crashes the scheduler), retries with exponential backoff, and records status.
- **Observe job status:** call the tRPC `health.readiness` procedure (protected).
  It returns `{ status, dbReady, jobs[] }`, where each job has `lastRunAt`,
  `lastSuccessAt`, `lastErrorAt`, `lastError`, `runs`, `failures`.

## 2. Health / readiness (Phase 016/035)

- `health.check` (public): process liveness (uptime, node version).
- `health.readiness` (protected): DB connectivity + job status. Returns
  `status: 'ready' | 'degraded'`.

## 3. Rate limits (Phase 018)

In-memory limiter (`server/rateLimit.ts`), keyed per user (or IP when anon).
Applied to:

| Action | Limit |
|---|---|
| `auth.login` | 10 / 15 min |
| `cases.create` | 5 / hour |
| `matching.findLawyers` | 30 / min |
| `workflow.initiateOutreach` | 5 / hour |
| `search.*` | general (100 / min) |

Note: the store is in-memory (per process). A distributed limiter (Redis) is a
later concern — documented, not implemented.

## 4. Idempotency (Phase 017)

- DB-level: a UNIQUE index on `outreach_status(caseId, lawyerId)` — a case can
  have at most one outreach row per lawyer (created idempotently at boot in
  `server/db.ts`).
- `workflow.initiateOutreach` is idempotent: re-invoking on a case already in
  `Outreach` returns `{ alreadyInitiated: true }` and does not re-write or
  re-audit.

## 5. Audit log (Phase 019)

- Writes: `server/audit.ts` `createAuditLog()` into the `audit_logs` table.
  Now wired into: case create/update/delete, `outreach.initiated`, and
  `user.login`.
- Reads: `audit.list` (protected) returns the **authenticated user's own** audit
  trail (filtered by userId; never cross-user). Supports `entityType`,
  `entityId`, `action`, `limit`.

## 6. Known operational gaps (tracked)

- Rate-limit store is in-memory (not shared across processes) — Phase 018 residual.
- Audit log has no retention/rotation — Phase 102.
- No emergency "stop all outreach" switch yet — Phase 104 (there is nothing to
  stop until the send path exists).
- Metrics/monitoring (Sentry/Datadog) not wired — Phase 035.
