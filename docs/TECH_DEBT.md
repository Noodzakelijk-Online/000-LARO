# Technical Debt Register

Updated: 2026-07-15

| # | Debt | Impact | Status / next step |
|---|---|---|---|
| D1 | All 14 routers are implemented, typed, mounted, and connected to UI actions | - | Resolved |
| D2 | Dedicated renderer `tsc` and ESLint are release-blocking | - | Resolved |
| D3 | Approved outreach uses the provider-backed, ownership-checked, emergency-stop and idempotency-gated send path | - | Resolved |
| D4 | OAuth token encryption uses authenticated AES-256-GCM | - | Resolved |
| D5 | CSRF origin guard, strict CORS, and JWT revocation are implemented | - | Resolved |
| D6 | `archiver` remains because evidence export uses it | Low - monitor runtime surface | Reassess each release |
| D7 | Current lockfile reports no known npm advisories | - | Re-audit each release |
| D8 | `shared/` and `src/shared/` overlap | Low - drift risk | Consolidate after import inventory |
| D9 | Historical `tests/*.test.ts` imports are excluded and replaced by current suites | Low - historical maintenance burden | Remove only after traceability review |
| D10 | Database integrity is primarily application-enforced rather than declared with foreign keys | Medium - reconciliation required | Add constraints through reviewed migrations |
| D11 | A top-level proprietary `LICENSE` is present | - | Resolved |
| D12 | Provenance-preserving ZIP evidence export is implemented; PDF remains intentionally unavailable | Low | Keep unavailable formats labelled honestly |
| D13 | Some money and count fields are stored as text | Low | Normalize through reviewed migrations |
| D14 | Renderer strings are not fully migrated to `t()` | Low | Complete i18n pass |

Current priorities are D10 for data integrity, D8 for shared-contract drift, and bundle splitting for renderer startup performance. Provider work must retain explicit credential, consent, approval, and audit gates.
