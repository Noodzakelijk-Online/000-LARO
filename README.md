# LARO: Legal Case Ledger

LARO is a local-first legal case operating system. It keeps a persistent, source-linked record of a case: documents, extracted text, timeline suggestions, claims, evidence links, contradictions, deadlines, open loops, outreach drafts, approvals, and audit history.

It organizes and prepares legal material. It is not a lawyer, does not provide definitive legal advice, and never sends legal communication or shares evidence externally without an explicit approval record.

## What Runs Locally

- Case Command Center: create and operate cases with progressive Focus, Guided, and Expert views.
- Document intelligence: read local text, PDF, DOCX, HTML, email-shaped, and Drive-shaped records; preserve source metadata and content hashes.
- Evidence timeline and papertrail: connect who said or did what and when back to the underlying document.
- Review workbench: confirm or reject suggested events, claims, evidence links, contradictions, deadlines, and open loops.
- Approval-gated outreach: create lawyer/media/organization matches and drafts, but do not send external messages.

Core case data is stored in a local SQLite ledger under `instance/laro_ledger.sqlite3`. Runtime databases, uploads, OAuth tokens, and local secrets are ignored by Git.

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

The launcher uses port `8768` by default so it does not collide with a typical Flask server on `5000`. Set `PORT` before launching to use another free local port.

## Google Evidence Sources

Optional Gmail and Drive read-only intake requires these values in `.env`:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:8768/api/google/oauth/callback
```

LARO stores connection status and a token fingerprint in the ledger, never raw OAuth tokens. Raw credentials are encrypted in the ignored local `tokens/` vault. Once connected, use the Documents tab in a case to run an explicit Gmail search or Drive query; LARO imports only those matching records, including supported Gmail attachments, preserves the original URI, deduplicates them, and records the read in the audit log.

## Optional Local Deep Reading

The default reader also performs a local, deterministic case-wide comparison of readable sources. It can flag literal differences in payment amounts or deadline dates, shared case references, and deadline wording without a recognizable date. Every result is review-only and opens the cited source document.

For deeper local-language analysis on your own machine, configure a local Ollama model in `.env`:

```text
LARO_ANALYSIS_PROVIDER=ollama
LARO_OLLAMA_BASE_URL=http://127.0.0.1:11434
LARO_OLLAMA_MODEL=<your-local-model>
```

LARO refuses non-loopback analysis URLs. Model output is retained only as review-only observations with literal source quotes; uncited output is discarded. It never becomes a confirmed fact, claim, deadline, or external communication automatically.

## Tests

Run the legal-ledger verification suite:

```powershell
python -m unittest test_legal_ledger test_document_intelligence test_google_oauth test_lawyer_matching test_outreach_targets test_outreach_analytics
```

The test suite uses temporary SQLite files and does not require a real Google account or contact any external lawyers.
