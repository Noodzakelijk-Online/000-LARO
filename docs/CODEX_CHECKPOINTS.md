# Codex Checkpoints — 000-LARO

Resumable checkpoints for context-loss safety (Phase 088). Each checkpoint states
where work stopped and what the next safe action is, so work can resume without
re-deriving state.

---

## Checkpoint 1 — 2026-07-06 — Foundation phases 000–004 complete

**Branch / commit:** `staging` @ `1b78ed6` (working tree modified, not committed)

**Done:**
- Full repository + PDF audit → `docs/phase-audit.md` (completion matrix for all 116 phases).
- Phase 000: repo cleanup (removed 5 junk/harmful files), integrity recorded.
- Phase 001: `docs/DEPENDENCY_AUDIT.md` (10 dead deps identified from import graph).
- Phase 002: `docs/PRODUCT_DEFINITION.md` (honest capability contract).
- Phase 003: `docs/CRITICAL_PATH.md` + runnable smoke test + `vitest.config.ts`. Verified: 7 pass / 9 todo.
- Phase 004: `docs/ARCHITECTURE.md` + corrected `PROJECT_INFO.md`.

**Verified by:**
- `npx vitest run tests/smoke` → 7 passed, 9 todo, 0 failed.
- `git ls-files` → no secrets/DB/uploads committed.

**Next safe action (Stage A — safety/honesty, do before feature work):**
1. Phase 006 — startup config guards: make `JWT_SECRET`/`COOKIE_SECRET` required in production, fail-fast; stop bundling `.env` into the artifact.
2. Phase 007 — remove the `local-default`/`local-dev-token` bearer backdoor in `server/context.ts:29-52`.
3. Phase 008 — replace `demo-user-123` fallbacks and add `userId` filters to the IDOR endpoints (`outreach.byCaseId`, `gapAnalysis.get*`, `cases.*progress`).

**Do NOT:** commit until owner approves; do not begin feature phases (011/025/026) before Stage A closes the auth/secrets holes — that ordering is deliberate (see `docs/phase-audit.md` §8).

---

## Checkpoint 2 — 2026-07-06 — Phases 005–010 complete

**Branch / commit:** `staging` @ `1b78ed6` (working tree modified)

**Done (real code + tests):**
- Phase 005: DB pragmas (WAL/foreign_keys/busy_timeout), unique email, hot indexes (`server/db.ts`).
- Phase 006: fail-fast `assertSecurityConfig()` + per-install secret bootstrap (`env.ts`, `src-main/index.ts`).
- Phase 007: removed production bearer backdoor → per-install `LOCAL_AGENT_TOKEN`; 30-day sessions. **Partial** (residuals in `docs/SECURITY.md` §5).
- Phase 008: `assertCaseOwnership` guard; IDOR endpoints protected; `demo-user-123` removed.
- Phase 009: tRPC error envelope; removed dead `error-handler.ts`.
- Phase 010: `docs/FRONTEND_ARCHITECTURE.md`; demo-mode no longer leaks data. **Partial**.

**Verified:** `tsc -p tsconfig.server.json` clean; `tsc -p tsconfig.main.json` clean; `npx vitest run tests/smoke` → 24 pass / 9 todo.

**Process caution:** do NOT run `git stash` mid-task — a stash during a long typecheck once reverted the working tree; recovered via `git stash pop`. Avoid.

**Next safe action:** Phase 029/030/100 security follow-ups (stop bundling `.env`; AES-GCM token crypto; helmet/CSRF), then Stage B features — Phase 011 (wire real matching), 025 (classification), 026 (approval gate).

---

## Checkpoint 3 — 2026-07-06 — Phases 011–015

**Branch:** `Phase-Imp` (not pushed — owner pushes next)

**Done (real code + tests):**
- 011: real matching engine wired into `matching` router (Partial — needs classification 025).
- 012: honest provider connectors (`enhancedConnections.ts`) + `docs/PROVIDERS.md`.
- 013: `LEGAL_DISCLAIMER` on generated legal docs + `docs/COMPLIANCE.md` (Partial).
- 014: removed fake OCR / dashboard stats / mocked outreachProgress → honest.
- 015: `storage.ts` sanitize + real local fallback + sha256 (Partial — wire hash everywhere; export 023).

**Verified:** server + main `tsc` clean; `npx vitest run tests/smoke` → 43 pass / 9 todo.

**Next safe action:** Phase 025 (classification) so matching has legal areas to work with; then 026 (approval gate) before any real outreach send; then 016–019 (jobs/idempotency/rate-limits/audit) on the outreach path.

---

## Checkpoint 4 — 2026-07-06 — Phases 016–020

**Branch:** `Phase-Imp` (not pushed — owner pushes next)

**Done:**
- 016: cron `runJob()` retry+status; honest outreach heartbeat; `health.readiness`. **Implemented**.
- 017: unique outreach index + idempotent initiateOutreach. **Partial** (send-path keys → 026).
- 018: `enforceRateLimit` on login/case-create/matching/outreach. **Implemented**.
- 019: audit filtering + `audit.list` read + wired into CRUD/login/outreach. **Implemented**.
- 020: `dashboard.nextActions` from real case state. **Partial** (UI surface → 037/109).

**Verified:** server + main `tsc` clean; `vitest tests/smoke` → 53 pass / 9 todo.

**Next safe action:** Phase 021–024 (forms/validation/autosave, search/filters, import/export, templates) or jump to the Stage-B remainder (025 classification → 026 approval gate) to unblock the real outreach path that 016–019 are waiting on.

---

## Checkpoint 5 — 2026-07-06 — Phases 021–030

**Branch:** `Phase-Imp` (not pushed).

**Done (real code + tests):**
- 021 validation schemas + case-draft autosave; 022 list filters/sort; 023 case export JSON+CSV;
  024 message-template CRUD; 025 **deterministic classifier** (unblocks matching); 026 **approval gate**
  (drafts → approve/reject, no send); 027 real notifications; 028 **real GDPR export+erasure**;
  029 security headers; 030 removed .env from installer + .env.example.

**Verified:** server + main `tsc` clean; `npx vitest run tests/smoke` → 72 pass / 9 todo.

**Key unblock:** case creation now auto-classifies legal areas, so Phase 011 matching produces
real results; the approval gate is ready to gate a real send.

**Next safe action:** implement the real outreach **send** through a configured provider behind the
approval gate (the one remaining critical-path gap), then 031–039 (dev/deploy/observability) and
040–044 (make the full test suite runnable).

---

## Checkpoint 6 — 2026-07-06 — Phases 031–040

**Branch:** `Phase-Imp` (not pushed).

**Done (all Implemented):** 031 setup script; 032 Dockerfile/compose (server backend);
033 db-backup + restore; 034 doctor CLI; 035 /api/live+/ready+/health; 036 admin diagnostics;
037 demo-mode labelling (system.appInfo); 038 fake-provider lab (prod-guarded); 039 test factories;
040 **real DB-backed backend test suite**.

**Key wins:** rebuilt better-sqlite3 for Node so the backend suite runs here; it exercises
classification → real matching → ownership → GDPR export/erasure end to end, and **caught a real
bug** (SQL `LIKE '__%'` wildcard excluded every table, breaking GDPR delete + cases.delete cascade) —
fixed in gdpr.ts, admin.ts, cases.ts.

**Verified:** server+main tsc clean; `npx vitest run` → 9 files, 76 passed, 9 todo; doctor/setup/db-backup run.

**Next safe action:** Phase 041 (repair the legacy tests/*.test.ts and add frontend/component tests),
then the real outreach **send** behind the approval gate — the last critical-path gap.
