# Roadmap and External Gates

Current as of 2026-07-16.

## Completed Production Path

- Local-first Electron runtime with generated per-install secrets.
- Authenticated case, evidence, document intelligence, source-linked timeline,
  official NOvA matching, controlled outreach, responses, analytics, export,
  scanner, audit, retention, backup, and recovery workflows.
- Review-gated media and organization discovery and local case matching.
- Emergency stop, feature flag, ownership, approval, provider, audit, and
  idempotency controls around irreversible delivery.
- Blocking TypeScript, lint, safety, traceability, recovery, Node, and Python
  checks.
- Target database integrity, invariant, reconciliation, foreign-key, and
  demo-marker readiness checks.

## External Acceptance

| Item | Current state | Completion evidence |
| --- | --- | --- |
| Google Gmail/Drive | Pending target credentials and consent | Connect, import representative records, verify provenance and token lifecycle |
| Outbound and inbound email | Pending target provider account | Deliver once, reject duplicate send, ingest and thread a reply |
| Optional S3 | Pending only if enabled | Store, retrieve, hash-check, and delete a representative evidence file |
| Optional provider-backed AI | Pending only if enabled | Retain only literal source-linked findings and fail closed on invalid citations |
| Public brand approval | Pending owner review | Approved brand record in `release-acceptance.json` |
| Trusted public Windows distribution | Not selected | Store certification or valid Authenticode signature and matching checksum |

The owner selected unsigned internal distribution, so certificate procurement is
not a current product requirement. Missing optional providers remain disabled and
must not be represented as operational.

## Engineering Follow-Up

1. Expand declared foreign keys after installed-data reconciliation; the
   production data-readiness gate now detects violations before migration.
2. Complete renderer NL/EN string migration.
3. Add component-level axe and visual-regression coverage across every mounted
   screen.
4. Normalize historical text-backed numeric fields through a reviewed migration.
5. Continue renderer bundle splitting and dependency review.

These items improve maintainability and coverage; they do not replace the
target-account acceptance required for any enabled external provider.
