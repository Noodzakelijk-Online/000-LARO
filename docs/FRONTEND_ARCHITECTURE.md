# Frontend Architecture

Current as of 2026-07-15.

## Surfaces

`src/renderer/main.tsx` selects two shipped React surfaces:

- `DashboardApp`: the authenticated case, evidence, matching, outreach, settings,
  privacy, messaging, help, and administration product.
- `App`: the scanner mini-app, loaded only with `?mode=scanner`.

Both use the same integrated loopback API. Packaged Desktop uses the current
window origin, including an OS-assigned port. The scanner receives the per-install
agent token through context-isolated IPC.

## Dashboard Routes

| Route | Status |
| --- | --- |
| `/` | Real dashboard and next actions |
| `/cases` | Real owned case workflow |
| `/lawyers`, `/lawyers/:id` | Real lawyer data and matching |
| `/outreach`, `/analytics` | Real outreach pipeline and owned performance metrics |
| `/messages`, `/email` | Real persisted communication surface |
| `/settings`, `/privacy` | Real user and data controls |
| `/admin`, `/admin-analytics` | Server role-gated administration |
| `/help` | Real help and error catalog |

Evidence is case-centric and intentionally redirects users into a case rather
than maintaining a second global evidence workflow. Billing, reports, and email
automation routes remain honest placeholders and are not primary sidebar items.

## Quality Boundary

- Dashboard auth is gated by `auth.me`; server procedures enforce ownership.
- Renderer TypeScript and ESLint are blocking release gates.
- The dashboard mark is shipped locally; startup does not depend on a CDN.
- External links are protocol-checked by Electron before opening.
- Responsive desktop and mobile browser checks are part of release verification.
