# Process Rules

Current as of 2026-07-16.

## Evidence Before Claims

- A feature is complete only under `docs/DEFINITION_OF_DONE.md`.
- Repository checks, packaged-runtime checks, and external acceptance are
  separate evidence classes and must be reported separately.
- Historical phase documents are audit records, not the current product state.
- No failing check, disabled capability, or pending provider may be hidden by a
  broad completion statement.

## Work Ordering

1. Resolve ownership, privacy, security, data-loss, and irreversible-action
   defects before adding surface area.
2. Preserve review and approval gates for evidence, directory discovery, and
   outreach.
3. Keep unsupported providers visibly unavailable and fail explicitly.
4. Run the full gate after implementation and rebuild the actual artifact after
   renderer, main, server, or packaging changes.
5. Update reproducible evidence, checksum, PR status, and CI before release.

The current critical path is real and gated. Remaining external work is target
acceptance, not an invitation to substitute mock success.
