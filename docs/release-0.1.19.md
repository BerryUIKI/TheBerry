# TheBerry 0.1.19 — Persistence Hardening

Release type: patch
Planned from: `dev` after #218–#223

## Highlights

This release hardens persistence paths and finishes the follow-up cleanup from 0.1.18. No new features are included.

## Fixed

- Malformed database rows now produce a descriptive error instead of being silently dropped in snippets, launcher, clipboard, folder sync, and backup export (#218).
- Launcher and snippet updates preserve `created_at`; launcher updates preserve `launch_count` (#218).
- Backup restore no longer reports success when inserts or the config save fail; the pre-restore safety snapshot is also checked (#218).
- Clipboard image persistence reports directory, PNG, and thumbnail failures and avoids leaving an orphan media path (#218).
- QuickLook and clipboard-monitor toggles fail clearly when the data directory is not initialized (#218).
- Folder Sync history write failures are logged, while the sync result still returns (#218).

## Internal

- One shared `formatBytes`/`formatSpeed` utility replaces nine local copies (#219).
- Residual catch blocks were audited: Structured Data copy failures now show a toast, the fake Windows data-path fallback was removed, and QuickLook close failures are logged (#219).

## Verification

- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Artifacts

The standard release matrix:

- `the-berry_windows_x64.msi` / `.exe` + SHA-256
- `the-berry_linux_x64.AppImage` / `.deb` + SHA-256
- `the-berry_macos_aarch64.dmg` + SHA-256
