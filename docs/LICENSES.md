# License and Third-Party Service Review (Phase 067)

Current as of 2026-07-16.

## Project license

The repository declares a top-level proprietary `LICENSE`. Redistribution and
use must follow that license unless the owner replaces it.

## Key dependencies and licenses

| Package | License |
| --- | --- |
| react, react-dom | MIT |
| express, tRPC (`@trpc/*`) | MIT |
| drizzle-orm | Apache-2.0 |
| better-sqlite3 | MIT |
| electron | MIT |
| tailwindcss, `@radix-ui/*` | MIT |
| zod, superjson, nanoid | MIT |
| `@aws-sdk/*` | Apache-2.0 |
| googleapis, google-auth-library | Apache-2.0 |
| vite, vitest | MIT |

The primary runtime dependencies use permissive licenses compatible with the
current proprietary desktop distribution. The lockfile and dependency license
inventory must be reviewed again for each release.

## Third-party services

| Service | Use | Terms note |
| --- | --- | --- |
| Google Gmail and Drive APIs | Evidence collection | Google API Services User Data Policy; OAuth verification may be required |
| Microsoft Graph | Outlook and OneDrive | Microsoft APIs Terms of Use |
| AWS S3 | Optional evidence storage | AWS Customer Agreement |
| SendGrid or SMTP | Optional system and approved outreach email | Provider terms and anti-spam obligations |
| KvK and Rechtspraak open data | Dutch business and court data | Public open-data terms |

LARO has no payment-provider integration or paid usage tier. Outreach remains
human-approved and rate-limited; provider and applicable communication terms
still apply.
