# Value Review

Current as of 2026-07-16.

## User Outcome

LARO helps a user turn a legal matter into an inspectable case record: collect
real documents, understand source-grounded contents, reconstruct chronology,
find relevant support, prepare controlled outreach, and track responses.

| User need | Current delivery |
| --- | --- |
| Understand the case | Classification plus persisted document analysis |
| Know what happened and when | Evidence timeline with direct source controls |
| Find a suitable lawyer | Ranked matching against official NOvA profiles |
| Find outside support | Review-gated media and organization discovery/matching |
| Contact the right people safely | Draft, approval, pre-send review, gated delivery, and response tracking |
| Retain control of personal data | Owner isolation, export, managed-blob erasure, retention, backup, and recovery |
| See progress | Real outreach pipeline, response, quality, and trend analytics |

## Honest Boundary

Local case, evidence, analysis, timeline, matching, review, and export workflows
do not require a live external provider. Google collection, email delivery and
reply ingestion, optional S3, and optional provider-backed AI remain unavailable
until configured and accepted against the target account. Delivery is real but
disabled by default; it is never automatic and cannot bypass approval or
operator controls.

The supported current distribution is an unsigned internal Windows artifact,
not a trusted public installer.
