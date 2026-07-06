# Codex Worklog — 000-LARO

A running, append-only log of implementation work against the Giant Codex Goal Prompt.
Newest entries at the top. Each entry: date, phase(s), what changed, evidence, what remains.

Convention: this log records **what was actually done**, not intentions. If a phase
is only partially done, that is stated here and reflected in
`docs/GOAL_COMPLETION_MATRIX.md`.

---

## 2026-07-06 — Phases 005–010 (data model, config, auth, authz, API contract, frontend)

**Branch:** `staging` · **Base commit:** `1b78ed6`

### Phase 005 — Data model, ownership, persistence ([docs/DATA_MODEL.md](DATA_MODEL.md))
- [server/db.ts](../server/db.ts): added `applyConnectionPragmas` (WAL, `foreign_keys=ON`, `busy_timeout=5000`) and `ensureIndexes` (unique `users.email`, plus 10 hot-path indexes on outreach/evidence/email/messaging/rating). Idempotent, applied at boot; defensive unique-email creation that warns instead of crashing on legacy duplicates.
- Verified: `tsc -p tsconfig.server.json --noEmit` clean.

### Phase 006 — Config validation & startup guards ([docs/SECURITY.md](SECURITY.md) §1)
- [server/_core/env.ts](../server/_core/env.ts): added `assertSecurityConfig()` — **throws in production** if `JWT_SECRET`/`COOKIE_SECRET` are missing/insecure; warns in dev; reports unconfigured integrations. Wired into `startServer()` ([server/index.ts](../server/index.ts)).
- [src-main/index.ts](../src-main/index.ts): `bootstrapSecrets()` generates per-install random secrets to `userData/laro-secrets.json` (mode 0600) and sets them before importing the server → secure-by-default, no bricking.
- [package.json](../package.json): `dev:server` now runs with `NODE_ENV=development` so the guard doesn't fail-fast in local dev.
- Verified: `tests/smoke/configGuard.smoke.test.ts` — 4 passing (prod-throw, empty-throw, strong-pass, dev-warn).

### Phase 007 — Authentication & session security ([docs/SECURITY.md](SECURITY.md) §2)
- [server/context.ts](../server/context.ts): replaced the well-known `local-default`/`local-dev-token` **production backdoor** with a per-install `LOCAL_AGENT_TOKEN`; legacy constants accepted **only in development**.
- Session lifetime cut 365d → 30d (`SESSION_EXPIRES_IN`/`SESSION_MAX_AGE_MS` in [shared/const.ts](../shared/const.ts)); applied to signup/login/getApiToken.
- Wired the per-install token to the scanner: IPC `agent:token` ([src-main/index.ts](../src-main/index.ts)), preload `getAgentToken` ([src-main/preload.ts](../src-main/preload.ts)), and [AuthPage.tsx](../src/renderer/pages/AuthPage.tsx) uses it (falls back to `local-default` only outside Electron/dev).
- Note: the desktop uploader's `agent.addFile/*` endpoints do not exist server-side (already-dead path), so this change breaks no working feature.

### Phase 008 — Authorization & resource ownership ([docs/SECURITY.md](SECURITY.md) §3)
- New guard [server/_core/authz.ts](../server/_core/authz.ts) `assertCaseOwnership` (throws `FORBIDDEN`, no existence leak).
- Converted IDOR-prone public procedures to `protectedProcedure` + ownership check: `outreach.byCaseId`; `cases.outreachProgress/getOutreachByCaseId/progress`; all `gapAnalysis` case-scoped procedures.
- Removed the shared `demo-user-123` identity from `evidenceFiles`, `evidenceAnalytics`, `evidenceTimeline`, `userPreferences`, `support` (now protected + `ctx.user.id`).
- Verified: `tests/smoke/authz.smoke.test.ts` — 13 passing guards.

### Phase 009 — API contract & error envelope ([docs/SECURITY.md](SECURITY.md) §4)
- [server/_core/trpc.ts](../server/_core/trpc.ts): added an `errorFormatter` producing a stable `{ code, httpStatus, path, validation }` envelope (flattened Zod errors; no stack leakage).
- Removed the dead, unimported `server/error-handler.ts` (consolidated on the tRPC error path).

### Phase 010 — Frontend architecture & navigation ([docs/FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md))
- Documented the two renderer surfaces, wouter route inventory, and auth gating.
- The real navigation-safety fix is server-side (Phase 008): `?demo=true` no longer exposes a shared bucket — it now renders as a logged-out, dataless view. Visible demo labelling deferred to Phase 037.

### Verification for this batch
- `npx tsc -p tsconfig.server.json --noEmit` → clean. `tsconfig.main.json` → clean.
- `npx vitest run tests/smoke` → **24 passed, 9 todo, 0 failed**.
- Renderer `tsc` has ~425 **pre-existing** errors (built via Vite, no typecheck gate); the only renderer file changed here (`AuthPage.tsx`) is clean.

### What remains (deliberately out of scope for 005–010)
- Residual security items (bundled `.env`, weak OAuth-token crypto, CSRF/headers) tracked in `docs/SECURITY.md` §5 for Phases 029/030/100.
- Full DB-backed authz behavioural tests need a SQLite harness — Phase 040. Current authz tests are source-level anti-regression guards.
- The mocked `cases.outreachProgress` values remain (now ownership-guarded) — real data is Phase 014/011.

---

## 2026-07-06 — Phases 000–004 (foundation / ground-truth)

**Branch:** `staging` · **Starting commit:** `1b78ed6`

### Phase 000 — Repository integrity and true starting point
- Recorded true starting point: branch `staging`, HEAD `1b78ed6`, default branch `main`, 63 commits, first commit 2025-05-11. Working tree was clean before this change.
- Verified **no secrets, databases, uploads, or runtime files are committed** (`git ls-files` shows only source; `.gitignore` covers `.env*`, `*.sqlite`, `release/`). The real secret-exposure risk is the **packaged** `.env` (electron-builder `extraResources`), addressed later in Phases 030/100 — not the git repo.
- Removed committed junk that was misleading the tree:
  - `.github/workflows/Untitled` — 10-byte file containing only `ialihaider` (not a workflow).
  - `laro-desktop@1.0.0` — 0-byte file from an accidental shell redirect.
  - `tsc-err-out.txt` — stale build log (one npm warning line).
  - `fix_ts.py`, `patcher.js` — scripts that bulk-suppress TypeScript errors (cast to `any`, prepend `// @ts-nocheck`) against files that **do not exist in this repo**; unreferenced by any npm script or CI. They actively hide type errors and were dead. Removal recorded in the technical-debt register.
- Created the documentation trail required by the prompt appendix: this worklog, `CODEX_CHECKPOINTS.md`, `GOAL_COMPLETION_MATRIX.md`, and (from the audit task) `phase-audit.md`.

### Phase 001 — Complete file and dependency audit
- Produced `docs/DEPENDENCY_AUDIT.md` from real import-graph evidence (grep of `server/ src/ src-main/ scripts/ lib/ shared/`).
- Confirmed **10 declared dependencies have zero imports**: `pdf-parse`, `pdfkit`, `archiver`, `mammoth`, `tesseract.js`, `xlsx`, `stripe`, `socket.io`(+client), `@azure/msal-node`, `jose`. These map directly to unbuilt features (document parsing/OCR, PDF/zip export, billing, realtime). Kept (not removed) pending the phases that will implement those features; flagged in the technical-debt register so they cannot masquerade as working capability.

### Phase 002 — Product definition and user outcome contract
- Produced `docs/PRODUCT_DEFINITION.md`: who the user is, the outcome contract, and an **honest capability table** separating what works today from what is fake/dead/missing, plus the enforced safety boundaries.

### Phase 003 — Critical path definition and smoke test
- Produced `docs/CRITICAL_PATH.md`: the canonical step list, per-step status with `file:line` evidence, and **manual end-to-end verification steps** (with expected vs actual) for the steps that cannot yet be automated.
- Added a **runnable** smoke test `tests/smoke/criticalPath.smoke.test.ts` and a standalone `vitest.config.ts` (the repo previously had none, so `vitest` failed to start by loading the renderer's `vite.config.ts`). The smoke suite asserts the genuinely-wired pure units (legal-area normalization) and marks every not-yet-wired step as `todo` naming its implementing phase — so it can never be mistaken for full-path coverage.
- **Verification result:** `npx vitest run tests/smoke` → **7 passed, 9 todo, 0 failed** (2026-07-06).

### Phase 004 — Architecture decision and current stack validation
- Produced `docs/ARCHITECTURE.md`: the real architecture (Electron + in-process Express/tRPC + local SQLite via Drizzle), an architecture decision record, and the fail-safe/labelling gaps that later phases (006/014/037) must close.
- Corrected `PROJECT_INFO.md`, which described a **non-existent** Docker + MySQL 8.0 + Redis + `electron/` architecture. It now describes the actual shipped stack, with the aspirational stack moved to a clearly-labelled "Future / not implemented" section (Phase 075 truthfulness).

### What remains after this batch
- Phases 000–004 are documentation-and-integrity phases; the **product-behaviour** gaps they document (fake matching, missing classification, no real send, IDOR, default secrets, secrets-in-installer) are scheduled for Stage A–B phases (006, 007, 008, 011, 012, 014, 025, 026). No behaviour was changed in this batch beyond repo cleanup, the new smoke test, and truthful docs.
- Changes are **not yet committed** — awaiting owner review (per repository policy, commits happen on request).
