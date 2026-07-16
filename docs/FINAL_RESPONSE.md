# Final Response Requirements

Current as of 2026-07-16.

Release reporting must separate repository proof from target-environment
acceptance. A truthful completion report must:

1. State the supported release boundary: unsigned internal Windows delivery.
2. Cite reproducible evidence from `npm run gate`,
   `npm run readiness:production`, the packaged health probe, and CI.
3. Name pending external acceptance for public branding and every enabled live
   provider instead of presenting configuration as tested behavior.
4. Distinguish outreach preparation and approval from irreversible delivery.
   Delivery exists but remains disabled by default and requires ownership,
   approval, a real provider, the enabled flag, a released emergency stop,
   audit, and idempotency checks.
5. State whether the tested target database passed `npm run db:readiness`.
6. Never present demo, seed, or directory-discovery candidates as verified case
   results.

A final response must not call the product publicly production-ready while a
required target-account gate is pending. It may accurately call a green,
packaged build an unsigned internal release candidate.

## Template

> Repository status: <gate, readiness, package, and CI evidence>. Supported
> distribution: unsigned internal Windows build. External acceptance still
> pending: <brand and enabled providers>. Delivery remains disabled by default
> and cannot bypass approval or operator controls.
