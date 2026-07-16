# Product Definition

Current as of 2026-07-15.

## Purpose

LARO is a local-first Dutch legal case workspace. It helps a case owner collect
and understand evidence, build a source-linked chronology, identify suitable
support, prepare controlled outreach, record responses, and export an auditable
case package.

LARO assists with organization and preparation. It is not a lawyer and does not
provide definitive legal advice.

## Supported outcomes

| User | Outcome |
| --- | --- |
| Case owner | Move from intake to organized evidence, classification, matching, reviewed outreach, responses, and an exportable case record without losing provenance |
| Operator | See real owned metrics, inspect audit history, stop external actions, validate backups, and diagnose provider readiness |
| Lawyer or outreach recipient | Receive an approved, relevant message through a configured provider with the case context intended for disclosure |

## Safety contract

- Evidence retains its source, managed storage key, and SHA-256 provenance.
- Imported model observations require literal source support and remain
  reviewable suggestions.
- User-owned records are authorization-scoped; case children require case
  ownership.
- Preparing or approving outreach does not send it.
- Delivery requires an approved draft, owner authorization, a configured real
  provider, an enabled feature flag, a released emergency stop, and an unused
  idempotency state.
- Missing providers and unsupported capabilities fail explicitly.
- Demo mode is disabled in production.

## Capability contract

| Capability | Current state |
| --- | --- |
| Account and session management | Implemented with bcrypt, signed cookies/JWTs, revocation, password reset, CSRF/origin controls, and role gates |
| Case intake and ownership | Implemented and persisted |
| Gmail and Google Drive intake | Implemented when OAuth credentials and user consent are present |
| Local evidence upload | Implemented with bounded file types/sizes, local or S3 persistence, SHA-256 provenance, and rollback on record failure |
| Desktop folder scanner | Implemented with shared-session authentication, explicit folder consent, review and per-file selection, short-lived upload credentials, and real owner-scoped storage |
| Document intelligence | Deterministic extraction is implemented; optional loopback Ollama analysis is citation-gated; OCR remains explicitly unavailable |
| Evidence timeline | Implemented with story, horizontal, and vertical views plus direct source access |
| Lawyer matching | Implemented against persisted lawyer records and case-derived legal fields |
| Media and organization matching | Implemented as reviewable target matching; discovery is not represented as exhaustive |
| Outreach drafting and approval | Implemented with separate prepare, review, approve, reject, and send states |
| Provider delivery | Implemented but disabled by default and conditional on target provider configuration |
| Response and outreach analytics | Implemented from owned persisted records |
| GDPR access and erasure | Implemented |
| Evidence export | Provenance-preserving ZIP is implemented; unavailable formats remain labelled unavailable |

## Production boundary

The repository can produce an internally verified Windows release candidate.
Public distribution additionally requires Microsoft Store certification and
Store signing, or a valid Authenticode signature for direct portable delivery,
plus product-owner approval of the public brand mark and live target-account
acceptance for every enabled external provider.
