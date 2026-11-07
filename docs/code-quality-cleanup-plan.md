# Code Quality Cleanup & Release Plan

Status: 0.1.18 shipped; 0.1.19 prepared (2026-11-07)
Baseline: `v0.1.17`, `dev` at `586878c`

This plan tracks the cleanup that came out of the full over-defensiveness review. The work was split so every PR stayed small and independently reviewable.

## Goals

1. Fix the user-visible crashes and data-safety defects first.
2. Add a TypeScript typecheck gate so these defects cannot regress silently.
3. Remove over-defensive code that hides failures or duplicates defaults.
4. Ship the fixes as a patch release; no feature work is mixed in.

## Issue map and delivered PRs

| Issue | Scope | PR |
| --- | --- | --- |
| [#199](https://github.com/BerryUIKI/TheBerry/issues/199) | FolderPairBar references undefined `language` | [#210](https://github.com/BerryUIKI/TheBerry/pull/210) |
| [#200](https://github.com/BerryUIKI/TheBerry/issues/200) | StructuredDataModal invalid JSX identifiers | [#210](https://github.com/BerryUIKI/TheBerry/pull/210) |
| [#201](https://github.com/BerryUIKI/TheBerry/issues/201) | QR download `qrcode_.png` | [#210](https://github.com/BerryUIKI/TheBerry/pull/210) |
| [#202](https://github.com/BerryUIKI/TheBerry/issues/202) | AISection reads nonexistent `is_configured` | [#210](https://github.com/BerryUIKI/TheBerry/pull/210) |
| [#203](https://github.com/BerryUIKI/TheBerry/issues/203) | SystemDrive `path` / `mount_point` mismatch | [#211](https://github.com/BerryUIKI/TheBerry/pull/211) |
| [#204](https://github.com/BerryUIKI/TheBerry/issues/204) | Clipboard preview panics on multibyte UTF-8 | [#211](https://github.com/BerryUIKI/TheBerry/pull/211) |
| [#205](https://github.com/BerryUIKI/TheBerry/issues/205) | Folder sync directory handling / versioning data loss | [#211](https://github.com/BerryUIKI/TheBerry/pull/211) |
| [#206](https://github.com/BerryUIKI/TheBerry/issues/206) | Backend over-defensive cleanup | [#212](https://github.com/BerryUIKI/TheBerry/pull/212), [#213](https://github.com/BerryUIKI/TheBerry/pull/213) |
| [#207](https://github.com/BerryUIKI/TheBerry/issues/207) | Frontend over-defensive cleanup | [#214](https://github.com/BerryUIKI/TheBerry/pull/214) |
| [#208](https://github.com/BerryUIKI/TheBerry/issues/208) | Add `tsc --noEmit` to CI | [#215](https://github.com/BerryUIKI/TheBerry/pull/215) |
| [#218](https://github.com/BerryUIKI/TheBerry/issues/218) | Surface database read/persistence errors | [#220](https://github.com/BerryUIKI/TheBerry/pull/220), [#222](https://github.com/BerryUIKI/TheBerry/pull/222) |
| [#219](https://github.com/BerryUIKI/TheBerry/issues/219) | Share byte formatting and audit catch blocks | [#221](https://github.com/BerryUIKI/TheBerry/pull/221), [#223](https://github.com/BerryUIKI/TheBerry/pull/223) |

The release plan itself was added in [#209](https://github.com/BerryUIKI/TheBerry/pull/209).

## Follow-ups delivered in 0.1.19

- Database row iteration errors now propagate in snippets, launcher, clipboard, folder sync, and backup export.
- Launcher/snippet timestamps and launcher launch counts are preserved on update.
- Backup restore, clipboard image persistence, and settings persistence now surface failures.
- One shared `formatBytes`/`formatSpeed` utility replaces nine local copies.
- Residual catch blocks were audited; user-facing failures show a toast or log.

## Release plan

### 0.1.18 — Correctness and cleanup (patch, shipped)

All fixes and cleanup from #199–#215 shipped as one patch release because the cleanup changes are internal and the fixes were urgent.

Release gates:

- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Manual smoke: Folder Sync (directory create/delete + versioning), Structured Data, QR tool, AI settings, File Search drive selection, long CJK clipboard copy.
- Bump `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to `0.1.18`.
- PR `dev` → `main`, tag `v0.1.18`.

### 0.1.19 — Persistence hardening (patch)

Contents:
- #218 — database read/persistence errors, timestamp/launch-count preservation, backup restore failures, clipboard image persistence, settings persistence.
- #219 — shared byte formatter and residual catch audit.

Release gates: the same clippy/test/typecheck/build gates as 0.1.18.
- Bump the three version files to `0.1.19`.
- PR `dev` → `main`, tag `v0.1.19`.

### 0.2.0 — Next feature release

Reserved for feature work after the cleanup lands.

## Branch and release rules

- Never commit directly to `dev` or `main`; both require a PR.
- One logical change per commit; imperative commit subjects (`fix:`, `refactor:`, `ci:`).
- Every PR links its issue(s).
- Keep `dev` releasable at all times: do not merge a PR that leaves CI red.
- If a release must be rolled back, revert the `dev` → `main` merge commit and publish a new patch tag; never force-push `main`.
