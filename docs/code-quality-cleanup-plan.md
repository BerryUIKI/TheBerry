# Code Quality Cleanup & Release Plan

Status: active (started 2026-11-06)
Baseline: `v0.1.17`, `dev` at `586878c`

This plan tracks the cleanup that came out of the full over-defensiveness review. The work is split so that every PR is small, reviewable, and independently releasable.

## Goals

1. Fix the user-visible crashes and data-safety defects first.
2. Add a TypeScript typecheck gate so these defects cannot regress silently.
3. Remove over-defensive code that hides failures or duplicates defaults.
4. Ship the fixes as patch releases; no feature work is mixed in.

## Issue map

| Issue | Scope | Priority |
| --- | --- | --- |
| [#199](https://github.com/BerryUIKI/TheBerry/issues/199) | FolderPairBar references undefined `language` | P0 |
| [#200](https://github.com/BerryUIKI/TheBerry/issues/200) | StructuredDataModal invalid JSX identifiers | P0 |
| [#201](https://github.com/BerryUIKI/TheBerry/issues/201) | QR download `qrcode_.png` | P1 |
| [#202](https://github.com/BerryUIKI/TheBerry/issues/202) | AISection reads nonexistent `is_configured` | P2 |
| [#203](https://github.com/BerryUIKI/TheBerry/issues/203) | SystemDrive `path` / `mount_point` mismatch | P1 |
| [#204](https://github.com/BerryUIKI/TheBerry/issues/204) | Clipboard preview panics on multibyte UTF-8 | P0 |
| [#205](https://github.com/BerryUIKI/TheBerry/issues/205) | Folder sync directory handling / versioning data loss | P0 |
| [#206](https://github.com/BerryUIKI/TheBerry/issues/206) | Backend over-defensive cleanup | P1 |
| [#207](https://github.com/BerryUIKI/TheBerry/issues/207) | Frontend over-defensive cleanup | P1 |
| [#208](https://github.com/BerryUIKI/TheBerry/issues/208) | Add `tsc --noEmit` to CI | P1 |

## PR sequence

Each PR targets `dev` from a `codex/*` branch and should stay under ~400 changed lines where possible.

### PR 1 — Frontend runtime fixes
Branch: `codex/fix-frontend-runtime-errors`
Closes: #199, #200, #201, #202

- Add the missing `language` binding in `FolderPairBar`.
- Quote the pane labels in `StructuredDataModal`.
- Quote the QR download filename.
- Derive the AI configuration status from real `AIConfig` fields.
- One commit per fix; add regression coverage where practical.

### PR 2 — Backend data safety and contracts
Branch: `codex/fix-data-safety-contracts`
Closes: #203, #204, #205

- Align `SystemDrive` with the frontend (keep `path`) and fix the test fixtures.
- Build clipboard previews with `chars().take(140)` and add a CJK regression test.
- Handle directory entries explicitly in folder sync; move whole directories into versioning storage.

### PR 3 — Backend over-defensive cleanup
Branch: `codex/backend-overdefense`
Closes: #206

- Remove duplicated `AppConfig` serde defaults.
- Extract the repeated `ConvertResult` failure constructor.
- Delete the unreachable Goose non-stream branch and no-op statements.
- Remove dead helpers/types and hardcoded versions/paths.
- Surface persistence errors instead of `let _ =`.

### PR 4 — Frontend over-defensive cleanup
Branch: `codex/frontend-overdefense`
Closes: #207

- Remove environment guards, redundant array checks, and duplicated defaults.
- Initialize `LocalRuntimePanel` with an idle status.
- Extract the shared `formatBytes` utility.
- Keep behavior unchanged.

### PR 5 — Typecheck cleanup and gate
Branch: `codex/typecheck-gate`
Closes: #208

- Fix the remaining `tsc --noEmit` errors (mostly unused declarations).
- Add `"typecheck": "tsc --noEmit"` to `package.json`.
- Add the CI step after all current errors are fixed, so `dev` never goes red.
- This PR must land after PRs 1–4; if it is opened earlier, it is stacked on their branches and retargeted to `dev` after they merge.

## Release plan

### 0.1.18 — Correctness and data safety (patch)

Target: immediately after PRs 1 and 2 are merged.

Contents:
- #199, #200, #201, #202 — frontend crashes/display
- #203 — drive selection contract
- #204 — clipboard UTF-8 panic
- #205 — folder sync directory/versioning safety

Release gates:
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm test`
- `pnpm build`
- Manual smoke: Folder Sync, Structured Data, QR tool, AI settings, File Search drive selection, clipboard copy of long Chinese text, mirror sync with versioning on a directory.
- Bump `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` to `0.1.18`.
- PR `dev` → `main`, tag `v0.1.18`.

### 0.1.19 — Internal cleanup (patch, no features)

Target: after PRs 3–5 are merged.

Contents:
- #206 — backend over-defensive cleanup
- #207 — frontend over-defensive cleanup
- #208 — TypeScript typecheck gate

Release gates:
- Same test/build gates as 0.1.18.
- `pnpm typecheck` must pass in CI.
- No functional changes intended; smoke test the same views.
- Bump all three version files to `0.1.19`.
- PR `dev` → `main`, tag `v0.1.19`.

### 0.2.0 — Next feature release

Reserved for feature work after the cleanup lands. Do not bundle cleanup refactors into 0.2.0 once 0.1.19 has shipped.

## Branch and release rules

- Never commit directly to `dev` or `main`; both require a PR.
- One logical change per commit; imperative commit subjects (`fix:`, `refactor:`, `ci:`).
- Every PR links its issue(s) with `Closes #NNN`.
- Keep `dev` releasable at all times: do not merge a PR that leaves CI red.
- If a release must be rolled back, revert the `dev` → `main` merge commit and publish a new patch tag; never force-push `main`.
