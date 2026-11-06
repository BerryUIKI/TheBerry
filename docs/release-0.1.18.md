# TheBerry 0.1.18 — Correctness and Code Quality

Release type: patch
Planned from: `dev` after #199–#215

## Highlights

This release fixes four view/modal crashes and two data-safety defects, then lands the code-quality cleanup from the full review. No new features are included.

## Fixed

- Folder Sync view crashed because `FolderPairBar` referenced an undefined `language` binding (#199).
- The Structured Data tool crashed on open because of invalid JSX identifiers (#200).
- QR code download threw `ReferenceError: qrcode_ is not defined` (#201).
- AI settings reported "not configured" by reading a nonexistent field (#202).
- File search drive selection used a `mount_point` field the backend never returned (#203).
- Clipboard previews panicked when byte 140 split a multibyte UTF-8 character (#204).
- Folder Sync treated directories as file copy/delete targets; Mirror + Versioning could delete a right-only directory's contents without archiving them (#205).

## Internal

- Added `pnpm typecheck` (`tsc --noEmit`) to CI and fixed all 132 existing type errors (#208).
- Removed duplicated `AppConfig` defaults, dead helpers/types, no-op statements, and hardcoded versions/paths (#206).
- Replaced eight repeated image-conversion failure constructors with a single `Default`-based shape; unsupported output formats now fail explicitly (#206).
- Removed redundant frontend guards, array checks, environment checks, duplicate theme writes, and stale default handling (#207).
- Clipboard monitoring now starts at the configured default (`false`) instead of an inconsistent in-memory `true`.
- Startup database initialization failures are logged instead of silently ignored.

## Verification

- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm typecheck`
- `pnpm test` — 112 tests
- `pnpm build`
- Manual smoke test: Folder Sync (including directory create/delete + versioning), Structured Data, QR download, AI settings, File Search drive selection, long CJK clipboard copy.

## Artifacts

The standard matrix from the release workflow:

- `the-berry_windows_x64.msi` / `.exe` + SHA-256
- `the-berry_linux_x64.AppImage` / `.deb` + SHA-256
- `the-berry_macos_aarch64.dmg` + SHA-256
