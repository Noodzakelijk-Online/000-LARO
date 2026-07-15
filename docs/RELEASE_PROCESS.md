# Release Process

## Branches and Versions

Changes enter `main` through a reviewed pull request with passing CI. Use
semantic versions from `package.json`, add the matching changelog entry, and tag
the accepted main commit as `vX.Y.Z`. Tags build and publish the Windows portable
artifact through `.github/workflows/build.yml`.

Tagged releases fail closed unless the tag exactly matches `package.json`,
`WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` repository secrets are set,
and Windows reports the executable's Authenticode signature as `Valid`. The
workflow publishes only the versioned portable executable and its SHA-256
checksum. Main-branch and manual builds remain internal validation artifacts.

## Pre-release Gates

```powershell
npm ci
npm run gate
npm run readiness
npm audit --omit=dev
npm run dist:win
```

For an API deployment, also run `npm run readiness:production` with the target
environment. Confirm no `.env`, database, upload, token, or unrelated development
asset appears in the package. Confirm the signature and checksum before rollout.

## Canary

Risky behavior ships disabled. In particular, `outreach.send.enabled` defaults
to `false` and must only be enabled after provider, approval, ownership,
idempotency, emergency-stop, and audit checks pass.

## Rollback

1. Engage the emergency stop for an outreach incident.
2. Reinstall the previous signed or retained application artifact.
3. Validate the pre-release database backup.
4. Stop traffic or close Desktop, then run `npm run db:restore -- <backup>`.
5. Start the application and verify `/api/live`, `/api/ready`, `/api/health`,
   `admin.invariants`, and the critical user flow.

Do not restore a database while another process can continue writing to it.
