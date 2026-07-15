# Dependency and Package Audit

Current as of 2026-07-15.

The repository has one active Node workspace at the root. The obsolete duplicate
manifest and lockfile formerly stored under `assets/` were removed; `assets/`
now contains only the two validated JSON datasets copied into Desktop builds.

## Shipped source roots

| Root | Purpose |
| --- | --- |
| `server/` | Express/tRPC API, data access, providers, workflow and operations |
| `src/renderer/` | React dashboard and scanner mini-app |
| `src-main/` | Electron lifecycle, native scanner, IPC and uploader |
| `shared/` | Canonical cross-process contracts |
| `drizzle/` | SQLite migration history |
| `scripts/` | Build, diagnostics, safety, recovery and release tools |

Electron packaging includes `dist`, production `node_modules`, `drizzle`,
`package.json`, and only the two matcher datasets explicitly listed in
`build.extraResources`. Development Python/HTML assets, local configuration,
databases, uploads, and token stores are not packaged.

## Required runtime groups

- React, Radix, TanStack Query, tRPC, Wouter, Recharts, Tailwind helpers and
  Lucide power the renderer.
- Express, tRPC, Zod, Drizzle and better-sqlite3 power the local API.
- Google APIs, Microsoft Graph, AWS S3, Nodemailer/SendGrid, Telegram and
  provider adapters are conditional integrations.
- Socket.IO powers authenticated user-scoped notifications.
- Archiver powers provenance-preserving ZIP evidence export.
- bcrypt and jsonwebtoken power account and session controls.

## Removed unused surface

The current audit removed unused `@azure/msal-node`, `jose`, `mammoth`,
`pdf-parse`, `isomorphic-fetch`, `ws`, and their obsolete standalone type
packages. None had a shipped-source import. Removing them reduced the install by
33 transitive packages without cutting a working capability.

OCR remains explicitly unavailable; no parser dependency is retained merely to
imply otherwise. The Flask document-intelligence runtime has its own Python
dependencies in `requirements.txt`.

## Release checks

- `npm ci --ignore-scripts` must reproduce the lockfile.
- `npm audit --omit=dev` must have no unresolved runtime advisory.
- The TypeScript and renderer builds prove every declared import resolves.
- `npm run verify:electron-native` proves the packaged SQLite ABI.
- Tagged public artifacts must be version-matched and Authenticode-valid.
