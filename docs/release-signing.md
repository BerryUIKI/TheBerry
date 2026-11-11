# Release signing and notarization

Status: macOS signing is wired but inactive until the repository secrets below exist. Windows Authenticode is not wired yet. The current published artifacts are unsigned.

## Current behavior

- The release workflow passes Apple signing variables to `pnpm tauri build`. Tauri signs and notarizes the macOS bundle automatically when they are present, and builds an unsigned DMG when they are not.
- Windows installers are not Authenticode-signed, so SmartScreen warns on first run.
- The updater verifies the published SHA-256 of the downloaded installer before running it. That detects corrupted or substituted downloads, but it is not a signature: a compromised release with a replaced checksum would still pass. Signed updates require a separate signing key and a change to the update format.

## macOS secrets

Create an Apple Developer ID Application certificate and export it as `.p12`, then add these repository secrets:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 of the `.p12` file |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Full identity, e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | Apple account email used for notarization |
| `APPLE_PASSWORD` | App-specific password for that account |
| `APPLE_TEAM_ID` | Apple Developer team identifier |

With all six set, the release build signs with the hardened runtime, submits for notarization, and staples the ticket. Verify a published DMG with:

```bash
codesign --verify --deep --strict --verbose=2 TheBerry.app
spctl --assess --type execute --verbose=4 TheBerry.app
xcrun stapler validate TheBerry.app
```

## Windows Authenticode

Windows signing needs a certificate and a `bundle.windows.signCommand` (or certificate thumbprint) in `src-tauri/tauri.conf.json`. Two common options:

1. **Azure Trusted Signing**: configure `bundle.windows.signCommand` to call `trusted-signing-cli` with `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and the endpoint/account/profile names.
2. **Traditional certificate**: import the `.pfx` into the runner certificate store and set `certificateThumbprint`, `digestAlgorithm`, and `timestampUrl` in the bundle configuration.

Add the chosen credentials as repository secrets and pass them to the build step before enabling this in a release.

## Platform note

The macOS artifact is Apple Silicon (arm64) only. Intel Macs are not supported by the current release matrix; adding `x86_64-apple-darwin` requires an Intel runner label that is still available in GitHub Actions.
