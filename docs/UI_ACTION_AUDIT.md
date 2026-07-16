# UI Action Audit

Current as of 2026-07-16. This supersedes the original phase-073 snapshot that
identified fourteen missing router groups.

## Current Supported Surface

| Area | User action | Backing behavior |
| --- | --- | --- |
| Authentication | Sign up, sign in, reset, sign out | Real sessions and revocation |
| Cases | Create, autosave draft, update, delete, export | Owner-scoped database actions |
| Evidence | Upload/import, analyze, search, open source, delete | Persisted bytes, provenance, owner checks |
| Timeline | Review chronology and open source | Source-linked document analysis |
| Outreach | Match, prepare, approve, reject, review, deliver, record reply | Real gated workflows; delivery disabled by default |
| Directories | Search lawyers, discover media/organizations, review candidates | Official/public sources with review gates |
| Privacy | Export and erase account data | Database and managed-blob erasure |
| Operations | Diagnostics, readiness, backup, restore, emergency stop | Admin/operator controls |

The fourteen router groups identified in the dated audit are now mounted and
typed. Unfinished pricing and billing prototypes are not mounted in the
production route tree. Reachable unsupported actions must remain hidden or
return an explicit unavailable state; fabricated success is prohibited.

## Regression Rules

- Renderer TypeScript and ESLint are release-blocking.
- Mounted routes are exercised through browser QA for the release-critical path.
- Any new irreversible action requires explicit confirmation, owner scope,
  audit, idempotency, and a visible error state.
