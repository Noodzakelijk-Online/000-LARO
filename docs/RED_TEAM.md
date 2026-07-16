# Red-Team Review

Original review: 2026-07-06. Current amendment: 2026-07-16.

## Data Isolation and Erasure

- Case ownership and cross-user isolation are enforced and tested.
- Account erasure removes user-scoped and case-scoped database rows.
- The former residual managed-blob leak is resolved: evidence deletion, case
  deletion, and account erasure discover `storageKey` and `s3Key` references,
  delete every object before removing metadata, and abort on storage or
  database failure. Integration coverage verifies canonical and scanner blobs.

## Authentication and Disclosure

- Provider diagnostics require authentication and expose configuration state,
  not secret values.
- Administrative procedures are role-gated; sensitive reads are owner-scoped.
- Scanner tokens are short-lived and restricted to evidence upload.

## Input, Provider, and Irreversible-Action Safety

- Oversized, malformed, traversal, and invalid-transition inputs are rejected.
- CSRF, strict CORS, authenticated token encryption, and revocation controls are
  implemented.
- Outreach delivery requires approval, provider configuration, feature enable,
  emergency-stop release, audit, and idempotency.
- Public directory discovery is bounded and review-gated.

Current residual engineering risks are maintained in `docs/TECH_DEBT.md`;
target-environment acceptance is maintained in `docs/ROADMAP.md` and
`release-acceptance.json`.
