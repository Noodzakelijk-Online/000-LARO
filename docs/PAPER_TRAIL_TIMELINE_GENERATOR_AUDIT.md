# Paper Trail Timeline Generator Audit

Date: 2026-07-22

Source: `Noodzakelijk-Online/024-Paper-trail-visualizer`, branch
`feat/document-timeline-generator`, commit `2508587`.

The branch has no common Git ancestor with the predecessor repository's main
branch. It is a separate Python/Flask prototype, not an incremental change to
the React metro-map implementation.

## Ported concepts

| Prototype concept | LARO implementation |
| --- | --- |
| Filter a timeline around one subject | Focus the case reconstruction on a source-derived analyzed participant |
| Group documents by discovered topics | Focus on named, source-linked legal issues instead of opaque LDA topic numbers |
| Extract actions associated with dates | Show the dated, source-linked actions retained for the selected document |
| Explore entity relationships | Combine participant focus with explicit and confidence-labelled document relationships |
| Refresh analysis when evidence changes | Use LARO's persisted imports, analysis state, automatic query invalidation, and controlled refresh |

## Not ported

- The Flask application uses a hard-coded session secret, process-global mutable
  status, unauthenticated routes, and raw local paths.
- The JSON cache is keyed by path and modification time and has no owner, case,
  content-hash, migration, or concurrency boundary.
- The English-only spaCy model and subject-verb-object heuristic are unsuitable
  for LARO's Dutch/English legal evidence and do not retain source citations.
- LDA labels such as `Topic #2` are not legal findings and provide no reviewable
  source basis.
- The filesystem watcher accepts a configured recursive path and analyzes files
  from a web-server thread. LARO instead confines local-folder collection to
  approved roots and managed evidence storage.
- Generated PyVis/Jinja HTML is a second unaudited presentation runtime and does
  not enforce LARO's owner-scoped source-opening contract.

## Retirement conclusion

LARO does not import, execute, or depend on this branch. Its useful interaction
ideas are represented by the production reconstruction contract and renderer;
the prototype branch is not required for operation or future migrations.
