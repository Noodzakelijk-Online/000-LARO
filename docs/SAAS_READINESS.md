# Local Operation Without Billing (Phase 056)

Current as of 2026-07-16.

LARO's supported product is fully usable without billing. Core case, evidence,
analysis, matching, timeline, review, and export workflows have no payment or
quota gate.

- `billing.status` reports `plan: "local"`, `billingConfigured:false`, and
  `forcedBilling:false`.
- `server/usageTracking.ts` stores operation and quantity counts as local
  operational telemetry. It does not calculate charges, report to a payment
  provider, send quota alerts, or block an action.
- Pricing, checkout, upgrade, grace-period, and usage-quota prototypes are not
  part of the production renderer or server runtime.
- Historical subscription and usage-limit database columns remain in migrations
  for compatibility with existing installations. They are not product policy.

This contract is verified in `tests/backend/phase051_060.test.ts` and
`tests/backend/usageTelemetry.test.ts`.
