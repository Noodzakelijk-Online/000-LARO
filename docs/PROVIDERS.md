# External Provider Status

Date: 2026-07-13

| Provider | Purpose | Required configuration | Current status |
|---|---|---|---|
| Google Gmail and Drive | Read-only evidence intake | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, consent | Available; encrypted PKCE OAuth and account-backed live status |
| Microsoft Outlook and OneDrive | Mail/file evidence | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, consent | Partial; OAuth available, collection depth varies by surface |
| Forge-compatible LLM | Provider-backed legal analysis | `FORGE_API_URL`, `FORGE_API_KEY` | Available when configured; otherwise fails closed |
| Local Ollama | Flask deep document reading | loopback `LARO_OLLAMA_*` | Optional; citation-gated local analysis |
| SMTP or SendGrid | Transactional email and approved sending | `SMTP_*` or `SENDGRID_API_KEY` | Available when configured; no console success in production |
| AWS S3 | Evidence object storage | bucket and workload/IAM credentials | Optional; real local-disk fallback |
| Telegram | Message evidence | `TELEGRAM_BOT_TOKEN` | Available when configured |
| Trello | Board evidence | API credentials plus secure token persistence | Disabled; secure token persistence is not implemented |
| Slack | Message evidence | not applicable | Unavailable |
| Rechtspraak | Court-record context and matching taxonomy | bundled datasets/public API | Bundled taxonomy and 5,400-case keyword analysis active; live lookup remains partial |

Provider configuration is not connection success. The UI must show connected only after persisted account state confirms OAuth completion.
