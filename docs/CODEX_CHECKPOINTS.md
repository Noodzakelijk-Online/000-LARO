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
