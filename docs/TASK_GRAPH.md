# Task Graph and Dependency Map

Current as of 2026-07-16.

```text
configuration + authentication + ownership
  -> case intake + classification
  -> evidence persistence + document intelligence + source timeline
  -> official directory matching + review-gated public discovery
  -> outreach preparation -> approval -> pre-send review
  -> provider + feature flag + emergency stop + idempotent delivery
  -> inbound response tracking + analytics

data readiness -> backup drill -> production preflight -> package -> health probe
              -> target provider acceptance -> controlled release
```

## Enforced Dependencies

1. User data is not exposed before authentication and ownership checks.
2. Evidence-derived claims retain source references.
3. Public-directory candidates require review before local persistence or use.
4. Outreach cannot deliver before approval, pre-send review, provider
   configuration, feature enablement, emergency-stop release, audit, and
   idempotency checks.
5. Release cannot advance on a red gate, failed target database readiness, or
   failed recovery drill.
6. An enabled external provider is not production-ready until its target account
   passes the acceptance path in `docs/ROADMAP.md`.

## Current Frontier

The repository-owned critical path is implemented. The next blocking work is
external acceptance for the providers actually selected for deployment and
owner approval of public branding. Engineering follow-up remains tracked in
`docs/TECH_DEBT.md`.
