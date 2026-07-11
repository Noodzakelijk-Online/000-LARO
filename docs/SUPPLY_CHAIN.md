# Supply Chain & Dependency Review (Phase 066)

Date: 2026-07-06 · Branch `Phase-Imp`

## Dependency posture
- Lockfile committed (`package-lock.json`); installs are reproducible.
- Native module: `better-sqlite3` (rebuilt per platform/Electron).
- Dead/unused heavy deps identified in `docs/DEPENDENCY_AUDIT.md` (pdf-parse,
  pdfkit, archiver, mammoth, tesseract.js, xlsx, stripe, socket.io, jose,
  @azure/msal-node) — kept as feature markers, to be built or dropped per phase.

## `npm audit` snapshot (2026-07-06)
Advisory counts (transitive + dev included):

| Severity | Count |
|---|---|
| critical | 2 |
| high | 22 |
| moderate | 20 |
| low | 2 |
| **total** | **46** |

Most are transitive/dev-chain (build tooling, Electron toolchain). None are known
to be reachable from the runtime request path, but they must be triaged before a
production claim.

## Actions
1. `npm audit fix` for non-breaking updates; review breaking ones individually.
2. Remove dead deps (see DEPENDENCY_AUDIT) to shrink the surface.
3. Add `npm audit` to CI as a **reported** (non-blocking) step initially, then
   gate on `--audit-level=high` once the count is triaged. (CI added in Phase 068.)
4. Pin GitHub Actions to full-length SHAs (currently major-version tags).

## Provenance
- No postinstall network fetches beyond the standard registry.
- The packaged app no longer ships `.env` secrets (Phase 030).
