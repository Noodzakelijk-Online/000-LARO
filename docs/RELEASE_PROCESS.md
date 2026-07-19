# Release Process

## Branches and Versions

Changes enter `main` through a reviewed pull request with passing CI. Use
semantic versions from `package.json` and add the matching changelog entry.
Normal Windows builds are unsigned internal artifacts. No signing provider is
currently selected. Versioned `vX.Y.Z` tags may publish the same unsigned
portable executable after the external acceptance gates are approved.

Tagged releases fail closed unless the tag exactly matches `package.json`, a
supported distribution mode is selected, and `release-acceptance.json` records
approved public-brand and live-provider gates. Each approval must identify its
approver, timestamp, evidence references, and, for providers, the tested provider
scope. The workflow publishes only the versioned portable executable and its
SHA-256 checksum. Signed modes additionally require Windows to report the
executable's Authenticode signature as `Valid`.

## Windows Signing

Set the repository variable `WINDOWS_SIGNING_PROVIDER` to one of the following.
Leaving it unset is equivalent to `unsigned`.

- `unsigned`: publishes the portable executable and SHA-256 checksum without a
  certificate. Windows may show an unknown-publisher or SmartScreen warning.
  This is the current owner-selected mode.

- `microsoft-store` (optional, no recurring signing fee): creates an unsigned
  APPX submission package whose identity must exactly match Partner Center.
  Microsoft re-signs accepted Store packages with its own trusted certificate.
  Store `MICROSOFT_STORE_IDENTITY_NAME`, `MICROSOFT_STORE_PUBLISHER`, and
  `MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME` as repository variables, using the
  exact values from the app's Partner Center Product identity page. Run the
  `Build Microsoft Store Submission` workflow and upload its APPX artifact to
  Partner Center. This trust applies to Store delivery, not portable EXEs.
- `sslcom-esigner`: uses SSL.com eSigner without Azure or a local hardware
  token. Store `SSL_COM_USERNAME`, `SSL_COM_PASSWORD`,
  `SSL_COM_CREDENTIAL_ID`, and `SSL_COM_TOTP_SECRET` as repository secrets.
  Obtain an organization-validated code-signing certificate with eSigner cloud
  signing, enable automated signing, and use the production credential ID.
- `azure-artifact-signing`: uses Microsoft Artifact Signing with
  GitHub OIDC. Store `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
  `AZURE_SUBSCRIPTION_ID` as repository secrets. Store
  `AZURE_ARTIFACT_SIGNING_ENDPOINT`, `AZURE_ARTIFACT_SIGNING_ACCOUNT`, and
  `AZURE_ARTIFACT_SIGNING_PROFILE` as repository variables. The Azure identity
  needs the Artifact Signing Certificate Profile Signer role and a federated
  credential for the release tag's GitHub OIDC subject.
- `pfx`: store the base64-encoded certificate in `WINDOWS_CSC_LINK` and its
  password in `WINDOWS_CSC_KEY_PASSWORD` as repository secrets.

Every configured signing-provider output is checked with
`Get-AuthenticodeSignature` before GitHub may publish it. Unsigned output is
published only in the explicit or default unsigned mode and remains untrusted by
Windows. Azure signing uses Microsoft's RFC 3161 timestamp service; eSigner
signs and timestamps through SSL.com's cloud-HSM service.

The optional Microsoft Store route is intentionally different: the repository produces
an unsigned submission package and validates its manifest identity. Microsoft
signs the package only after Store certification. The Store package must not be
distributed directly before Microsoft signs it.

## Pre-release Gates

```powershell
npm ci
npm run gate
npm run readiness
npm audit --omit=dev
npm run dist:win
npm run release:check
```

For Store submission, reserve the product name and copy the exact Partner Center
identity values into the repository variables, then run:

```powershell
npm run dist:store
```

For an API deployment, also run `npm run readiness:production` with the target
environment. Confirm no `.env`, database, upload, token, or unrelated development
asset appears in the package. Confirm the checksum and, when signing is enabled,
the signature before rollout.
Confirm that `build/icon.png` is the product-owner-approved public LARO mark.
Before tagging, update `release-acceptance.json` in a reviewed pull request. A
pending record is valid for normal development but blocks every tagged release.

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
