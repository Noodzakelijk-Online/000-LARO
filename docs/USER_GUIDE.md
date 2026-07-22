# LARO User Guide

Date: 2026-07-22

In-app help mirrors this guide (served by the `help.topics` endpoint).

## What LARO does
Describe a legal case → LARO classifies it, gathers evidence, finds suitable
lawyers, and prepares outreach. **You approve everything before anything is sent.**

> **Not legal advice.** LARO assists and prepares; it is not a substitute for a
> qualified lawyer. Always have generated documents/analyses reviewed.

## Step by step
1. **Sign in / create account** — Settings has account + privacy controls.
2. **Create a case** (Cases → New): client details + a description. LARO
   auto-classifies the case into legal areas.
3. **Add evidence**: upload files, or connect Gmail/Drive (if configured). A
   desktop folder is selected through the native picker. A keyword pull
   continues as a persisted job and shows its current source, extracted words,
   reviewed items, progress, and time estimate. Each imported item keeps its
   source and content hash for provenance.
   In the case Analysis tab, use Analyze all pending to process existing stored
   documents without uploading them again.
4. **Review the timeline**: open Timeline and start with Document map. Documents
   are stations, colors separate event routes, solid arrows come from source
   metadata or literal references, and dashed arrows are similarity suggestions.
   Select a station to read its summary and relationship basis, use the question
   mark control to open the source, and enable Trace selection to follow the
   connected history. Use Focus to isolate documents involving one analyzed
   participant or legal topic; selecting a station also reveals the dated actions
   retained from that document. Legal events, source chronology, and operational
   activity remain available in the adjacent tabs.
5. **Review matched lawyers**: open the case to see ranked matches (expertise,
   availability, response time, distance). No one is contacted here.
6. **Prepare & approve outreach**: prepare drafts, then review each. Before
   sending you see who will be contacted, that it's **not reversible**, and a
   disclaimer. Approving marks a draft ready — **nothing is sent automatically**.
7. **Track & export**: follow status; export a case (JSON) or your whole account
   (Privacy → Export). You can also permanently delete your account + data.

## Privacy
Your data stays local (and in your own configured cloud storage). No third-party
analytics. Export/erase anytime (Settings → Privacy). See docs/PRIVACY.md.

## Getting help
- In-app Help (topics + error catalog).
- Troubleshooting: docs/TROUBLESHOOTING.md.
