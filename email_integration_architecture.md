# Email And Evidence Provider Architecture

Updated: 2026-07-21

## Current Boundaries

LARO uses connected Google accounts for owner-triggered evidence intake. The
Google OAuth grant covers Gmail read access, Drive read access, and the account
email needed to identify the connection. It does not grant Gmail send or label
write access.

Lawyer outreach does not send through a connected evidence account. Approved
outreach is delivered through the separately configured SendGrid or SMTP system
provider and remains behind ownership, human approval, feature-flag,
emergency-stop, audit, and idempotency checks.

Microsoft OAuth primitives remain in the codebase for future work, but Outlook
and OneDrive evidence collection is unavailable until a complete owner-scoped
collector and live acceptance exist. Trello and Slack are likewise unavailable.
The interface and provider checklist must not describe credentials alone as a
working connection.

## Google Flow

1. An authenticated owner requests a Google connection URL.
2. The server creates encrypted, expiring OAuth state and a PKCE verifier.
3. Electron opens the provider in a sandboxed, context-isolated child window.
4. The loopback callback consumes the state for the same owner and stores access
   and refresh tokens encrypted with AES-256-GCM.
5. Connection status becomes `connected` only after the account row persists.
6. Gmail/Drive pulls are explicit and case-scoped. Imported bytes enter managed
   storage with SHA-256 provenance and supported documents are analyzed.
7. Disconnecting either Google source first revokes the durable grant at
   Google, then removes the shared owner credential and both Gmail/Drive
   connection records. A provider failure retains the encrypted credential for
   retry. Existing imported evidence remains part of the legal case until the
   owner deletes it.

## Outreach Flow

1. Matching creates a reviewable draft; it does not send.
2. The owner reviews and explicitly approves the draft.
3. Delivery is available only when `outreach.send.enabled` is enabled, the
   emergency stop is released, and SendGrid or SMTP is configured.
4. The server rechecks case ownership and an idempotency guard before delivery.
5. A provider failure leaves the draft unsent. A successful provider call
   records the provider and audit transition.

## Release Acceptance

Configuration presence is only a precondition. Every enabled provider must be
exercised with a target account and representative non-sensitive data, including
failure behavior, persisted audit evidence, and cleanup. The approved scope and
evidence references belong in `release-acceptance.json`. Optional providers
without acceptance remain disabled and visibly unavailable.
