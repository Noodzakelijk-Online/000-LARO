# LARO: Legal Case Ledger

LARO is a local-first legal case operating system. It keeps a persistent, source-linked record of a case: documents, extracted text, timeline suggestions, claims, evidence links, contradictions, deadlines, obligations, open loops, outreach drafts, approvals, and audit history.

It organizes and prepares legal material. It is not a lawyer, does not provide definitive legal advice, and never sends legal communication or shares evidence externally without an explicit approval record.

## What Runs Locally

- Case Command Center: create and operate cases with progressive Focus, Guided, and Expert views.
- Document intelligence: read local text, PDF, DOCX, HTML, email-shaped, and Drive-shaped records; preserve source metadata and content hashes.
- Evidence timeline and papertrail: connect who said or did what and when back to the underlying document.
- Review workbench: confirm or reject suggested events, claims, evidence links, contradictions, deadlines, obligations, and open loops.
- Obligation register: track who must do what, for whose benefit, by which date, and from which source; extracted duties remain unconfirmed until reviewed.
- Generated briefs: create source-linked case summaries, lawyer briefings, and red-line drafts without copying ledger data into a separate tool.
- Approval-gated outreach: create lawyer/media/organization matches and drafts, but do not send external messages.

Core case data is stored in a local SQLite ledger under `instance/laro_ledger.sqlite3`. Authenticated case, approval, audit, and matching routes are scoped to the owning local user. Runtime databases, uploads, OAuth tokens, and local secrets are ignored by Git.

The dashboard's convenience session bootstrap only accepts requests from loopback and only for `LARO_LOCAL_ACCOUNT_EMAIL` (default: `robert.local@laro`). It is not a remote login mechanism; the existing password route remains available for additional accounts.

## Windows Quick Start

1. Install Python 3.11+.
2. In PowerShell from this repository, install dependencies:

```powershell
python -m pip install -r requirements.txt
```

3. Create local configuration:

```powershell
Copy-Item .env.example .env
```

4. Start LARO:

```powershell
.\run_local.ps1
```

5. Open [http://127.0.0.1:8768/case_command_center.html](http://127.0.0.1:8768/case_command_center.html).

The launcher uses port `8768` by default so it does not collide with a typical Flask server on `5000`. It binds to `127.0.0.1` only. Set `PORT` before launching to use another free local port.

## Google Evidence Sources

Optional Gmail and Drive read-only intake requires these values in `.env`:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:8768/api/google/oauth/callback
```

LARO stores connection status and a token fingerprint in the ledger, never raw OAuth tokens. Raw credentials are encrypted in the ignored local `tokens/` vault. Once connected, use the Documents tab in a case to run an explicit Gmail search or Drive query; LARO imports only those matching records, including supported Gmail attachments, preserves the original URI, deduplicates them, and records the read in the audit log.

## Optional Local Deep Reading

The default reader performs a full-source deterministic comparison of every readable case document. It can flag literal differences in payment amounts or deadline dates, shared case references, and deadline wording without a recognizable date. It also proposes a chronological source passage for every unambiguous date it finds; each proposal must be explicitly added to the reviewable timeline. Every result is review-only and opens the cited source document.

For deeper local-language analysis on your own machine, configure a local Ollama model in `.env`:

```text
LARO_ANALYSIS_PROVIDER=ollama
LARO_OLLAMA_BASE_URL=http://127.0.0.1:11434
LARO_OLLAMA_MODEL=<your-local-model>
```

LARO refuses non-loopback analysis URLs. Long sources are divided at sentence boundaries and every bounded batch is sent only to the configured loopback model. Model output is retained only as review-only observations with literal source quotes; uncited output is discarded. If a batch fails, no partial case-wide findings are stored. It never becomes a confirmed fact, claim, deadline, or external communication automatically.

Case-wide readings run as durable local jobs through `/api/cases/<id>/case-analysis/jobs`. The Case Command Center polls persisted document, source-chunk, word, character, elapsed-time, and ETA progress and refreshes automatically when the cited review run is ready. `LARO_LOCAL_ANALYSIS_MAX_CHARS` controls the maximum source characters in one local-model batch, not the total amount of case evidence that can be read.

## Tests

Run the legal-ledger verification suite:

```powershell
python -m unittest test_legal_ledger test_document_intelligence test_local_semantic_analysis test_google_oauth test_google_evidence test_lawyer_matching test_outreach_discovery test_outreach_targets test_outreach_analytics
```

The test suite uses temporary SQLite files and does not require a real Google account or contact any external lawyers.
