# Technical Debt Register

Updated: 2026-07-15

| # | Debt | Impact | Status / next step |
| --- | --- | --- | --- |
| D1 | All mounted routers are typed and connected to supported UI actions | - | Resolved |
| D2 | Renderer TypeScript and ESLint are release-blocking | - | Resolved |
| D3 | Approved outreach uses provider, ownership, emergency-stop and idempotency gates | - | Resolved |
| D4 | OAuth token encryption uses authenticated AES-256-GCM | - | Resolved |
| D5 | CSRF origin checks, strict CORS and JWT revocation are implemented | - | Resolved |
| D6 | `archiver` remains for evidence ZIP export | Low | Reassess each release |
| D7 | Current runtime lockfile has no known advisory | - | Re-audit each release |
| D8 | Duplicate `shared/` and `src/shared/` contracts | - | Resolved; `shared/` is canonical |
| D9 | Historical excluded tests and audit snapshots remain for traceability | Low | Keep clearly dated; remove only through reviewed archive work |
| D10 | Many database relationships are application-enforced rather than declared foreign keys | Medium | Reconcile installed data, then add reviewed constraints |
| D11 | Top-level proprietary license | - | Resolved |
| D12 | ZIP evidence export is implemented; unavailable formats remain explicit | Low | Keep capability labels honest |
| D13 | Some money and count fields are stored as text | Low | Normalize through reviewed migrations |
| D14 | Renderer strings are not fully migrated to `t()` | Low | Complete i18n pass |
| D15 | Desktop scanner previously accepted false connection success and fabricated uploads | - | Resolved with session auth, folder consent, review selection and real evidence storage |
| D16 | Full cross-browser and automated accessibility coverage is incomplete | Low | Expand in subsequent release cycles |

The highest remaining engineering priority is D10. It requires migration
planning and installed-data reconciliation, not an unreviewed boot-time table
rewrite. D14 and D16 are incremental quality work. Provider rollout must retain
credential, consent, approval and audit gates.
