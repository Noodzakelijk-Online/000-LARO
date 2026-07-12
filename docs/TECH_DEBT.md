# Technical Debt Register (Phase 076)

Date: 2026-07-06 · Branch `Phase-Imp`

| # | Debt | Impact | Ref / next phase |
|---|---|---|---|
| D1 | Renderer references 14 non-existent routers (broken UI actions) | High — buttons error at runtime | UI_ACTION_AUDIT (073); hide/implement (010/014/037) |
| D2 | Renderer `tsc` has ~425 pre-existing type errors | Med — no type safety in UI; built via Vite (no gate) | 041 |
| D3 | Real outreach **send** not implemented | High — critical-path gap | scaffolded + flag-gated (026/058) |
| D4 | OAuth-token encryption weak (`Buffer.alloc(32, secret)`, CBC) | High — token confidentiality | SECURITY §5; use AES-GCM |
| D5 | No CSRF / permissive dev CORS; no JWT revocation | Med | 029/007 follow-ups |
| D6 | Dead heavy deps (pdfkit, archiver, tesseract, stripe, …) | Low — surface/size | DEPENDENCY_AUDIT; build or drop |
| D7 | `npm audit`: 46 advisories (2 critical) | Med — supply chain | SUPPLY_CHAIN (066); triage |
| D8 | Duplicated `shared/` vs `src/shared/` | Low — drift risk | merge |
| D9 | Legacy `tests/*.test.ts` broken imports (excluded) | Low — replaced by new suites | 041 |
| D10 | No declared FKs (integrity app-enforced) | Med — needs reconcile | 054 mitigates; 061 verifies |
| D11 | No top-level LICENSE | Med — distribution blocker | 067 |
| D12 | PDF/zip evidence export missing (JSON only) | Low | 023 |
| D13 | Money/counts stored as TEXT | Low | 060/061 |
| D14 | i18n: renderer strings not migrated to `t()` | Low | 057 |

Ranked remediation: **D1/D3/D4** first (they touch the critical path and
security), then D7/D11 (release blockers), then the rest.
