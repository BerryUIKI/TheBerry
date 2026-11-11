# TheBerry 0.2.0 — Trusted Updates and Diagnostics

Release type: minor
Planned from: `dev` after #229 and #230

## Highlights

This release hardens the path that downloads and runs installers, applies a production webview policy, and makes the application observable. No new user-facing tools are added.

## Security and trust

- The updater accepts only the pinned asset name for the current platform and never selects a `.sha256` sidecar or an arbitrary release asset (#230).
- After the transfer, the installer is verified against the published `<asset>.sha256`; a mismatch deletes the file and blocks installation (#230).
- `csp: null` is replaced with a production Content Security Policy covering the asset protocol, IPC, data/blob previews, and workers; the development policy additionally allows Vite HMR (#230).
- The HUD window is granted `core:event:default`, restoring `listen("goose://stream-chunk")` for AI streaming in the HUD (#230).
- The release workflow passes Apple signing and notarization secrets to the build. Windows Authenticode remains documented but not wired. See [release-signing.md](release-signing.md) (#230).

## Diagnostics

- Backend `tracing` output now goes to `<data_dir>/logs/theberry.YYYY-MM-DD.log`, rotated daily with seven files retained; a panic hook records crashes in the same log (#229).
- Settings → About → **Export Diagnostics** writes a redacted report to Downloads with the version, platform, configuration, and recent logs. AI credentials are never included (#229).
- A Solid error boundary and global `error` / `unhandledrejection` handlers report frontend failures to the backend log (#229).

## Behavior notes

- The production CSP blocks remote images and remote resources in Markdown previews; `data:` and asset-protocol sources continue to work. This is intentional for an offline-first app.
- The updater requires the `.sha256` sidecar published by the standard release workflow.
- macOS artifacts remain Apple Silicon (arm64) only. They stay unsigned until `APPLE_*` repository secrets are configured.
- Windows installers remain unsigned until an Authenticode certificate is configured.

## Verification

- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml` (updater tests 9/9, including asset pinning, checksum parsing, and file hashing)
- `pnpm typecheck`
- `pnpm test` (112 tests)
- `pnpm build`
- Production-CSP debug build smoke test: main window, `Alt+Space` HUD, settings window, diagnostics export; no ACL, CSP, or frontend errors. Deferred: PDF/image preview, xlsx conversion, Markdown preview, HUD AI streaming.

## Artifacts

The standard release matrix:

- `the-berry_windows_x64.msi` / `.exe` + SHA-256
- `the-berry_linux_x64.AppImage` / `.deb` + SHA-256
- `the-berry_macos_aarch64.dmg` + SHA-256
