# Critical Path

Current as of 2026-07-15. This document describes the shipped Electron/tRPC
runtime. Provider-backed steps remain conditional on target credentials.

## Canonical Flow

```text
account -> case intake -> evidence -> analysis/classification -> matching
        -> outreach drafts -> human approval -> provider send
        -> response recording -> outcome/analytics -> evidence package
```

## Current Status

| Step | Status | Authoritative evidence |
| --- | --- | --- |
| Account and session | Implemented | `server/routers/index.ts`; `tests/e2e/workflow.e2e.test.ts`; authentication and isolation suites |
| Case intake | Implemented | `server/routers/cases.ts`; acceptance AC1 |
| Evidence ingestion and provenance | Implemented | `server/routers/evidenceFiles.ts`; local/S3 storage with SHA-256; file-safety and hardening suites |
| Legal classification | Implemented | `server/classification.ts`; acceptance AC2 |
| Lawyer matching | Implemented | `server/matching.ts`; acceptance AC3 and backend integration |
| Outreach preparation | Implemented | `workflow.initiateOutreach` advances the case and prepares idempotent review drafts in one action |
| Human review | Implemented | Pending drafts require explicit approve/reject; approval does not send |
| Provider send | Implemented, gated | Emergency stop, feature flag, ownership, Approved state, configured provider, and idempotency are all required |
| Response recording | Implemented | `workflow.recordResponse` enforces ownership and legal state transitions; no automatic third-party action |
| Outcome and analytics | Implemented | Interested responses move the case to Matched; outreach analytics use owned persisted rows |
| Export package | Implemented | ZIP package and provenance manifest are exercised by backend tests |

## Safety Invariants

- Starting outreach prepares drafts but contacts nobody.
- Approval marks a draft ready but contacts nobody.
- Sending is disabled by default through `outreach.send.enabled`.
- A provider failure never produces a Sent state.
- Inbound outcomes cannot be recorded against another user's case.
- Recording a decline does not automatically contact another lawyer.

## External Acceptance

Repository tests use an injected delivery provider and cannot prove receipt by a
real mailbox. Before a live rollout, use an approved test recipient to verify the
configured SMTP/SendGrid account, then restore the feature flag to its intended
state. Google intake likewise requires target OAuth credentials and consent.

Run the complete repository proof with:

```powershell
npm run gate
npm run readiness:production
python -m unittest discover -v -p "test_*.py"
```
