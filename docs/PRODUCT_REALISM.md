# Product Realism Review

Current as of 2026-07-15.

| Surface | Product claim | Reality |
| --- | --- | --- |
| Case classification | derives legal areas | deterministic classification is persisted and tested |
| Evidence upload | stores source files | bytes are stored locally or in S3 with SHA-256 provenance |
| Desktop scanner | finds and uploads selected local evidence | explicit-folder scan, review selection, short-lived identity, and real owner-scoped upload |
| Document analysis | understands source content | deterministic extraction and citation-gated optional local analysis; OCR is explicitly unavailable |
| Lawyer matching | ranks suitable lawyers | real persisted records and case-derived matching; no random results |
| Outreach | prepares and sends reviewed messages | drafting and approval are real; delivery is separate, provider-backed, audited, and disabled by default |
| Analytics | shows progress and outcomes | computed from owned persisted rows |
| Usage telemetry | reports local activity | operation and quantity counts only; no prices, quotas, or payment provider |
| Demo mode | provides demonstration behavior | labelled and forced off in production |

No user-facing action may claim an external effect from a missing provider or an
unimplemented operation. Unavailable OCR and optional providers report their
state explicitly. Obsolete pricing, checkout, quota, and upgrade prototypes were
removed. Unfinished reports and email-automation routes are not mounted.

The supported distribution is an unsigned internal portable artifact. A future
trusted public release would require Store or signing acceptance. Approved
branding and live acceptance evidence remain required for each enabled external
provider.
