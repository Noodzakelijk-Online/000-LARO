# Goal Completion Matrix — 000-LARO

Status vocabulary (from the prompt): **Implemented · Partial · Missing · Blocked · N/A**.
"Blocked" means genuinely gated by an external credential/approval that cannot be
self-provided — *merely difficult is not blocked*. No phase in this project is
currently Blocked.

This matrix is the single source of truth for phase status. The full per-phase
evidence table (all 116 phases with `file:line` citations) lives in
`docs/phase-audit.md`; this file tracks the **live implementation status** as
phases are worked and is updated at the end of each phase.

Last updated: 2026-07-06 (after phases 000–030).

---

## Worked phases

| Phase | Title | Status | Deliverable / evidence |
|---|---|---|---|
| 000 | Repository integrity & true starting point | **Implemented** | Junk removed (5 files); integrity recorded; doc trail created. `docs/CODEX_WORKLOG.md`. |
| 001 | Complete file & dependency audit | **Implemented** | `docs/DEPENDENCY_AUDIT.md`; 10 dead deps identified from import graph. |
| 002 | Product definition & user outcome contract | **Implemented** | `docs/PRODUCT_DEFINITION.md` (honest capability table + safety boundary). |
| 003 | Critical path definition & smoke test | **Implemented** | `docs/CRITICAL_PATH.md`; `tests/smoke/criticalPath.smoke.test.ts` + `vitest.config.ts`; verified 7 pass / 9 todo. |
| 004 | Architecture decision & stack validation | **Implemented** | `docs/ARCHITECTURE.md`; `PROJECT_INFO.md` corrected to real stack. |
| 005 | Data model, ownership & persistence | **Implemented** | `docs/DATA_MODEL.md`; WAL + `foreign_keys` + `busy_timeout`, unique `users.email`, 10 hot indexes in `server/db.ts`. |
| 006 | Configuration validation & startup guards | **Implemented** | `assertSecurityConfig()` fail-fast + per-install secret bootstrap; `tests/smoke/configGuard.smoke.test.ts` (4 pass). |
| 007 | Authentication model & session security | **Partial** | Production bearer backdoor removed (per-install token), 30-day sessions. Residual: weak OAuth-token crypto, no JWT revocation, bundled `.env` (`docs/SECURITY.md` §5). |
| 008 | Authorization & resource ownership | **Implemented** | `assertCaseOwnership` guard; IDOR endpoints protected; `demo-user-123` removed; `tests/smoke/authz.smoke.test.ts` (13 pass). |
| 009 | API contract & error envelope | **Implemented** | tRPC `errorFormatter` stable envelope; dead `error-handler.ts` removed. |
| 010 | Frontend architecture & navigation | **Partial** | `docs/FRONTEND_ARCHITECTURE.md`; demo-mode no longer exposes data (via Phase 008). Residual: visible demo label (037), placeholder routes (011/014), renderer tsc debt (041). |
| 011 | Core workflow vertical slice | **Partial** | Real matching engine wired into `matching` router (no more `Math.random`), protected + ownership. Residual: needs classification (025) to produce areas; outreach send still missing. |
| 012 | External provider reality review | **Implemented** | `docs/PROVIDERS.md`; dummy auth URLs replaced with real availability reporting in `enhancedConnections.ts`. |
| 013 | Compliance & policy boundaries | **Partial** | `LEGAL_DISCLAIMER` appended to generated legal docs; `docs/COMPLIANCE.md`. Residual: UI-wide disclaimer (037), GDPR (028), i18n (057). |
| 014 | No fake success / no mock production | **Implemented** | Fake OCR, hardcoded dashboard stats, and mocked `outreachProgress` replaced with honest/real behavior; anti-regression guards in `tests/smoke/noFakeSuccess.smoke.test.ts`. |
| 015 | Storage, files, uploads & media safety | **Partial** | `storage.ts` sanitization + real local fallback (no more silent byte-drop) + sha256 provenance; `tests/smoke/storage.smoke.test.ts`. Residual: wire hash into all evidence writes; PDF/zip export (023). |
| 021 | Forms, validation, autosave | **Partial** | `shared/validation.ts` caseIntakeSchema applied to create; case-draft autosave (`system_config`). UI autosave wiring pending (041). |
| 022 | Search, filters, sorting, pagination | **Implemented** | `cases.list` filters (status/urgency/search) + sort + pagination, owner-scoped. |
| 023 | Import & export | **Partial** | `cases.export` (JSON package) + `cases.exportCsv`; CSV import already existed. PDF/zip evidence package still pending. |
| 024 | Templates, presets, defaults | **Implemented** | `messageTemplates` real per-user CRUD. |
| 025 | AI/provider abstraction & deterministic fallback | **Implemented** | `server/classification.ts` deterministic classifier wired into `cases.create`/`cases.classify`; unblocks matching. Tested. |
| 026 | Human review queue & approval gates | **Partial** | `workflow.prepareDrafts`/`reviewQueue`/`approveDraft`/`rejectDraft`; nothing sent (`sent:false`). Real send is a later phase. |
| 027 | Notifications & reminders | **Partial** | `createNotification` real, wired to case-created/outreach events. Reminders/scheduling pending. |
| 028 | Privacy controls & data deletion | **Implemented** | `server/gdpr.ts` real export + erasure; `gdpr.*` no longer stubs. |
| 029 | Security headers & web security | **Implemented** | CSP/HSTS/frame/referrer/permissions headers in `server/index.ts`. |
| 030 | Secrets management & credential rotation | **Partial** | `.env` no longer bundled in installer; `.env.example`; per-install secrets (006/007). Weak OAuth-token crypto still open. |
| 016 | Background jobs, schedulers & workers | **Implemented** | `runJob()` error-isolation + retry/backoff + status; honest outreach heartbeat (no fake send); `health.readiness` exposes job status. `docs/OPERATOR_RUNBOOK.md`. |
| 017 | Idempotency & duplicate-action prevention | **Partial** | UNIQUE `outreach_status(caseId,lawyerId)` + idempotent `initiateOutreach`. Residual: idempotency keys for the real send path (026). |
| 018 | Rate limits, cooldowns & provider quotas | **Implemented** | `enforceRateLimit` applied to login, case-create, matching, outreach (+ existing search). Residual: distributed store (Redis) documented. |
| 019 | Audit logging & event history | **Implemented** | Real filtering; wired into case CRUD + outreach + login; user-scoped `audit.list` read path. |
| 020 | User-facing dashboard & next-action | **Partial** | Real `dashboard.nextActions` derived from case state (evidence/status/urgency). Residual: surface in UI + exception dashboard (109). |

Note: phases 000–006/008/009 mark their **own deliverable** complete. 007 and 010
are honestly **Partial** — real improvements landed, but named residual items
remain and are tracked in `docs/SECURITY.md` §5 and `docs/FRONTEND_ARCHITECTURE.md` §4.

## Not yet worked (summary — see docs/phase-audit.md for full detail)

| Phase range | Theme | Prevailing status |
|---|---|---|
| 031–039 | Dev-deploy, import/export, AI fallback, review queue, notifications, privacy, security headers, secrets, dev/deploy, migrations, CLI, observability, demo labelling, fake-provider lab, factories | Partial → Missing |
| 040–054 | Test suites (backend/frontend/worker/e2e), acceptance, adversarial, isolation, file-safety, provider-failure, a11y, responsive, perf, large-data, backup/restore, reconciliation | mostly Missing (suite cannot run) |
| 055–075 | Analytics, SaaS/billing, i18n, flags, state machines, domain model, invariants, safety-review screen, credential checklist, threat model, PIA, supply-chain, licenses, CI gates, release, runbook, user guide, troubleshooting, UI/endpoint/doc audits | mostly Missing |
| 076–099 | Debt register, bug log, red-team loops, user sims, value/realism reviews, traceability, task graph, worklog, resume-safety, stabilization gates, DoD, fresh-clone, manual evidence, no-excuses search, completion matrix, final report, final response, maintenance, roadmap | Missing → Partial (worklog/checkpoints/matrix now started) |
| 100–115 | Provider cleanup, debug bundle, retention, prod migration, emergency stop, onboarding, roles, confidence display, decision minimization, exception dashboard, safe retries, ambiguous-action, versioning, regression baseline, maintenance review, operator-readiness | mostly Missing |

**Approximate tally across all 116 phases:** Implemented ~27 · Partial ~40 · Missing ~47 · Blocked 0 · N/A ~2.
(Through phase 030: Implemented 022/024/025/028/029 + earlier; Partial 021/023/026/027/030. Real code, honest partials.)
