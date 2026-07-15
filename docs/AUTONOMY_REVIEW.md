# Autonomy and Human Control

Current as of 2026-07-15.

| Step | Automation | Human or external boundary |
| --- | --- | --- |
| Classify case | Automatic deterministic classification | User can correct case context |
| Analyze evidence | Automatic when a configured provider is available; grounded output requires citations | Human reviews retained legal observations |
| Match lawyers | Automatic scoring and ranking | User chooses whether to begin outreach |
| Prepare outreach | One action prepares idempotent drafts | Nobody is contacted |
| Approve or reject | Manual | Required before every send |
| Send | Explicit action after approval | Feature flag, emergency stop, ownership, and provider readiness must pass |
| Record response | Manual/API-assisted | Ownership and state transition are enforced |
| Follow up | Reminder-only | LARO does not autonomously contact another lawyer |

The intended model is high automation for analysis and preparation with explicit
human control over irreversible external communication. Removing the approval
gate would be a regression, not an enhancement.
