# Technical Debt Register

Updated: 2026-07-20

| # | Debt | Impact | Status / next step |
| --- | --- | --- | --- |
| D1 | All mounted routers are typed and connected to supported UI actions | - | Resolved |
| D2 | Server, Electron, and renderer TypeScript plus ESLint are release-blocking; shipped runtime files cannot use `@ts-nocheck` | - | Resolved and regression-tested |
| D3 | Approved outreach uses provider, ownership, emergency-stop and idempotency gates | - | Resolved |
| D4 | OAuth token encryption uses authenticated AES-256-GCM | - | Resolved |
| D5 | CSRF origin checks, strict CORS and JWT revocation are implemented | - | Resolved |
| D6 | `archiver` remains for evidence ZIP export | Low | Reassess each release |
| D7 | Current runtime lockfile has no known advisory | - | Re-audit each release |
| D8 | Duplicate `shared/` and `src/shared/` contracts | - | Resolved; `shared/` is canonical |
| D9 | Historical excluded tests and audit snapshots remain for traceability | Low | Keep clearly dated; remove only through reviewed archive work |
| D10 | Historical tables use database triggers rather than native foreign-key clauses to avoid destructive installed-data rebuilds | Low | Startup enforces insert/update/delete relationships; readiness verifies every guard and reconciliation covers historical drift; replace with native FKs only through a backup-tested migration |
| D11 | Top-level proprietary license | - | Resolved |
| D12 | CSV and ZIP evidence export include a case-scoped index, redacted metadata, analyses, and available source files; PDF remains unavailable | Low | Keep capability labels honest |
| D13 | Historical subscription, usage-limit, and monetary usage columns remain in installed schemas | Low | Keep for compatibility; new telemetry writes quantity counts only and leaves monetary fields null |
| D14 | Renderer strings are not fully migrated to `t()` | Low | Complete i18n pass |
| D15 | Desktop scanner previously accepted false connection success and fabricated uploads | - | Resolved with session auth, folder consent, review selection and real evidence storage |
| D16 | Supported Electron/Chromium route accessibility and responsive coverage | - | Resolved with a CI Playwright/axe matrix across all 15 static routes at desktop and mobile sizes; non-target browsers and formal WCAG certification remain outside the packaged-app claim |
| D17 | Evidence, case, and account deletion could leave managed objects after metadata deletion | - | Resolved; managed storage keys are deleted first and failures abort deletion |
| D18 | KvK lookup used a stale query-string contract and a missing LinkedIn enrichment module | - | Resolved; uses the official open-dataset path contract, normalizes its response, and exposes only supported lookup controls |
| D19 | Retention was manual-only and accepted unsafe environment values | - | Resolved; bounded configuration fails startup, and an idempotent observable sweep runs after startup and daily |
| D20 | Legacy evidence scoring UI was connected to lawyer matching and the export view exposed inert buttons | - | Resolved with dedicated owner-scoped scoring/export routers and integration coverage; see `LEGACY_DASHBOARD_PORT_AUDIT.md` |
| D21 | Multiple desktop processes could share one SQLite profile and run duplicate background jobs | - | Resolved with an Electron single-instance lock, tested restore/show/focus handoff, and a packaged two-launch profile probe in the Windows release workflow |
| D22 | Electron sessions had no explicit browser-permission policy | - | Resolved with deny-by-default check/request handlers installed before any window and covered by behavioral/security tests |

D10 is operationally contained without rewriting installed databases. A native
foreign-key conversion remains migration work, not a release blocker while the
guard and reconciliation gates stay green. D14 and D16 are incremental quality
work. Provider rollout must retain credential, consent, approval and audit gates.
