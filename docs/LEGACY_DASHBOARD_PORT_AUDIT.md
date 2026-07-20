# Legacy Dashboard Port Audit

## Scope

This audit compares LARO with
[`Noodzakelijk-Online/lawyer-automation-dashboards`](https://github.com/Noodzakelijk-Online/lawyer-automation-dashboards),
using legacy `main` commit `9e87b36dad25a2143057f5ae9fd482692115c8ae`
and LARO commit `aacb2ae4da8d280d55347e554e67f614a06c0657` as the comparison baselines.
The comparison was performed on 2026-07-20.

The legacy repository is relevant as LARO's prototype lineage, not as a second
production backend. A content-hash comparison found 81 identical tracked
TypeScript, TSX, and JSON files already present in LARO. Examples include the
evidence export and relevance dashboards, case and document controls, outreach
progress, lawyer profile components, shared utilities, and backend tests.

## Completed Consolidation

The comparison exposed two incomplete integrations that were corrected in LARO:

1. Evidence relevance scoring now evaluates owner-scoped evidence against the
   persisted case type, summary, and legal areas. When a versioned document
   analysis exists, its source-linked findings participate in the score. Results,
   matched terms, method, reason, category, and timestamp are persisted without
   discarding existing evidence metadata.
2. Evidence export now downloads real case-scoped CSV and ZIP bytes. ZIP packages
   include a manifest, spreadsheet index, redacted metadata, persisted analyses,
   and every available managed source document. PDF remains visibly unavailable
   instead of presenting an inert or false-success action.

Both paths enforce owner and case scope and have integration coverage for
cross-account denial.

## Rejected Direct Ports

The following legacy modules must not be copied directly:

| Legacy area | Reason direct reuse was rejected |
| --- | --- |
| `relevanceScoringService.ts` and router | Case and evidence queries omit owner scope; model failures become a fabricated neutral score; response parsing is weak. |
| `evidenceQueryService.ts` and aggregation router | Repeats per-provider queries without owner scope and reports hard-coded collection health and future sync times. |
| `syncScheduler.ts` and `AutoSyncScheduler.tsx` | Stores access tokens in metadata, lists unimplemented providers as schedulable, simulates results with delays and random counts, and does not persist UI schedule changes. |
| `evidenceExportService.ts` | Reads unscoped case evidence, depends on S3 URLs, and does not package original evidence bytes. |
| `analytics.ts` | Returns random template usage counts and derives activity without a complete ownership boundary. |
| `ai-legal-inference.ts` and Rechtspraak keyword dumps | Contains encoding damage and noisy date/place/court tokens presented as legal-area signals; the dataset provenance is not sufficient for production matching. |
| `AnnotationCanvas.tsx` | Save is callback-only, eraser behavior is incomplete, annotations are not source-versioned, and pointer/touch accessibility is incomplete. |

## Future Candidates

- Source annotation can be reconsidered only with persisted annotation versions,
  immutable source hashes, coordinate transforms, touch/pointer support, and an
  audit trail.
- Per-source scheduling can be added only after schedule state is persisted and
  each visible provider has a real collection implementation with token-vault
  access, retry state, and truthful last/next-run reporting.
- Any legacy legal taxonomy or statistical dataset must be independently sourced,
  versioned, quality-checked, and licensed before use in matching.

The legacy repository should remain an archival reference. New production work
belongs in LARO's current SQLite, tRPC, owner-authorization, audit, storage, and
document-intelligence boundaries.
