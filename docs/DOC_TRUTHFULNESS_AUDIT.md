# Documentation Truthfulness Audit

Updated: 2026-07-20

Current operational claims were checked against source, release gates, database
tests, packaged runtime evidence, and protected-main workflows.

| Document | Current claim | Evidence | Verdict |
| --- | --- | --- | --- |
| `README.md` | Electron/tRPC and Flask compatibility runtimes are distinguished | Runtime entry points and build scripts | Accurate |
| `SECURITY.md` | Secrets are excluded and OAuth tokens use AES-256-GCM | Packaging manifest and token crypto tests | Accurate |
| `PRIVACY.md` | Export, managed-object erasure, preferences, and retention are real | GDPR, storage-failure, preference, and retention tests | Accurate |
| `API_USAGE_AUDIT.md` | Mounted renderer contracts are typed; unavailable providers fail honestly | `AppRouter`, renderer typecheck, provider tests | Accurate |
| `UI_ACTION_AUDIT.md` | Previously missing router groups are mounted | Router index and renderer calls | Accurate |
| `FINAL_VERIFICATION_REPORT.md` | Local and protected-main evidence is separated from external acceptance | Gate output, package smoke, Actions runs | Accurate |

Historical phase logs remain dated snapshots and may describe defects that were
subsequently fixed. They are retained for traceability and are not current
operator guidance.

## Remaining external claims

Repository evidence does not establish a GDPR legal basis, processor agreement,
provider consent, callback/delivery behavior in a target account, or approval of
the public product mark. Those claims remain prohibited until the owner records
the corresponding evidence.
