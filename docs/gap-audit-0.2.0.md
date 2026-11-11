# TheBerry 0.2.0 Gap Audit

Status: draft for review
Date: 2026-11-11
Baseline: `dev` at `f5a1aca` (0.1.19)

## Method

Compared the claims in [README.md](../README.md), [website/index.html](../website/index.html), and the Milestone 1-3 specifications against the current source. Counts for the test suites come from the CI run of PR #226. Findings are limited to gaps that affect users or release trust; internal style issues were handled in the 0.1.18/0.1.19 cleanup and are out of scope.

## Summary

The feature surface is broad and mostly implemented; the "17/17 toolbox" and bilingual claims hold at the inventory level. The highest-risk gaps are not missing features but **release trust and observability**:

1. Release artifacts are unsigned and un-notarized, and the updater executes downloaded installers without verifying any checksum or signature.
2. `tracing` is used throughout the backend, but no subscriber is ever initialized, so every log line in production is a no-op.
3. The `hud` window is missing from every Tauri capability file, which likely denies its `event.listen` call and breaks AI streaming in the HUD.
4. File search is a live `WalkDir` scan, not the indexed "disk-speed" search claimed by the README and planned in Milestone 1.

Recommended 0.2.0 scope: **release trust + diagnostics** (themes A and B below). File indexing is the strongest feature candidate if 0.2.0 is meant to be user-visible.

## Claim audit

| Claim | Source | Evidence | Status |
| --- | --- | --- | --- |
| Federated Spotlight search with `@app`, `@clip`, `@snip`, `@file` | README §1 | Implemented in [SpotlightModal.tsx](../src/components/SpotlightModal.tsx:68), opened with `Ctrl+K` in [App.tsx](../src/App.tsx:37). The `Alt+Space` HUD ([HudView.tsx](../src/views/HudView.tsx:49)) only searches launchers and files (`/fin`, `/f`) plus AI; it has no clipboard/snippet search or `@` filters. | Partial; two different "spotlight" surfaces |
| Disk-speed, instant multi-drive file search | README §6, Milestone 1 §3.3 | [indexer.rs](../src-tauri/src/modules/file_search/indexer.rs:107) walks the filesystem per query (`WalkDir`, depth 9, 250 results). There is no index, MFT/USN reader, or cached directory tree. | Claim overstated; performance gap |
| QuickLook previews | README §6 | Full implementation only on Windows ([windows.rs](../src-tauri/src/modules/quicklook/windows.rs)). Other platforms get a built-in fallback ([stub.rs](../src-tauri/src/modules/quicklook/stub.rs)) that renders image, video, audio, PDF, text, code, markdown, and CSV; Office documents fall through to a binary/text path. | Platform-limited; fallback is useful but narrower |
| 100% bilingual localization | README §8 | `en.ts` and `zh.ts` both have 480 keys with zero missing/extra keys. However, some toasts are hardcoded English, e.g. [FileSearchView.tsx](../src/views/FileSearchView.tsx:135) `info("Revealed in Explorer", ...)`. | Mostly accurate; toast titles are not fully localized |
| 17/17 toolbox suite | README §8 | 17 tool entries in [ToolboxView.tsx](../src/views/ToolboxView.tsx:86) (6 core views + 11 modals). | Accurate |
| Windows OCR and Word-to-PDF | README §8 | OCR runs a PowerShell `Windows.Media.Ocr` script ([ocr.rs](../src-tauri/src/modules/toolbox/ocr.rs:14)); Word conversion uses COM automation. Neither is platform-gated, and the UI shows no unsupported notice on macOS/Linux. | Windows-only tools presented on all platforms |
| 1-click auto-update | README §10 | Windows runs NSIS with `/S`; macOS opens the DMG; Linux runs the AppImage ([service.rs](../src-tauri/src/modules/updater/service.rs:375)). Downloads are accepted from GitHub domains over HTTPS only ([service.rs](../src-tauri/src/modules/updater/service.rs:160)). No checksum or signature verification. | Functional; integrity gap |
| Offline local AI (CUDA/Vulkan/Metal/CPU) | README §11 | Matches [local-models.md](local-models.md): pinned llama.cpp b11425 archives, SHA-256 checked, loopback-only server, import flow, backend selection. Catalog contains one model. MCP tool support requires an external Goose daemon ([ADR-0010](adr/ADR-0010-real-ai-config-and-direct-engine.md)); the bundled local runtime exposes only `get_current_time`. | Accurate but narrow |
| Custom per-application hotkeys | Milestone 1 §3.4 | No implementation in launcher or shortcuts services. | Not delivered |
| Clipboard direct-paste action | Milestone 1 §3.2 | Clipboard view supports copy, pin, delete, batch delete, JSON formatting, AI, and URL opening, but no simulated paste. | Not delivered |
| File context menu: Open with, Properties | Milestone 1 §3.3 | File search supports open, reveal, and copy path only ([FileSearchView.tsx](../src/views/FileSearchView.tsx:130)). | Partial |
| Windows 10/11 x64 only | README "Prerequisites" | Releases publish Windows x64, Linux x64, and macOS arm64; CI builds all three. The prerequisites section still describes Windows only. | Documentation inconsistent |

## Engineering gaps

### High

1. **No code signing or notarization.** [release.yml](../.github/workflows/release.yml) builds and uploads installers with no Authenticode or Apple signing steps. macOS users must bypass Gatekeeper; Windows shows SmartScreen warnings.
2. **The updater does not verify what it downloads.** [validate_download_url](../src-tauri/src/modules/updater/service.rs:160) checks only scheme and host. The release publishes `.sha256` files, but the updater ignores them, and it selects an asset by name keyword. A compromised GitHub release or asset could execute an arbitrary installer.
3. **Backend logging is dead code.** `tracing-subscriber` is a dependency ([Cargo.toml](../src-tauri/Cargo.toml:27)), but no `tracing_subscriber` initialization exists anywhere in `src-tauri/src`. Every `tracing::warn!` added in 0.1.18/0.1.19, including the persistence error paths, is silently discarded.
4. **The HUD window has no capability grant.** [capabilities/default.json](../src-tauri/capabilities/default.json) targets `["main"]`; [settings.json](../src-tauri/capabilities/settings.json) targets `["settings"]`. The `hud` window defined in [tauri.conf.json](../src-tauri/tauri.conf.json) is in neither, so its `listen("goose://stream-chunk")` call ([goose.ts](../src/services/goose.ts:30), used in [HudView.tsx](../src/views/HudView.tsx:105)) should be rejected by the ACL and AI streaming in the HUD should not update. This needs a runtime confirmation, but the static configuration is unambiguous.

### Medium

5. **File search has no index.** Each query re-walks the tree, so large home directories and multiple drives are slow, and the search does not survive or accelerate repeated queries. This is the largest gap between marketing and behavior.
6. **Windows-only tools are not marked as such.** OCR and Word-to-PDF fail at runtime on macOS/Linux with backend errors. A capability matrix in the toolbox would avoid dead-end UI.
7. **No scheduled or automatic backups.** [backup/commands.rs](../src-tauri/src/modules/backup/commands.rs) exposes manual export/import only. A corrupted database between manual backups is unrecoverable.
8. **No crash or error surface.** There is no Rust panic hook, no frontend `ErrorBoundary`, and no diagnostics/log export. A backend panic exits silently; a render error blanks the UI.
9. **Accessibility coverage is thin.** The frontend has 7 `aria-*` attributes across 4 files, 4 `role` attributes, and 22 modal components. Keyboard support exists in Spotlight/HUD but focus trapping and dialog semantics are largely absent.
10. **macOS x64 is not built.** The release matrix builds `aarch64-apple-darwin` only ([release.yml](../.github/workflows/release.yml:51)), while the updater already recognizes a `macos_x64` asset key ([service.rs](../src-tauri/src/modules/updater/service.rs:84)). Intel Macs have no artifact.
11. **No end-to-end tests.** Rust integration tests and Vitest cover logic well (82 backend, 112 frontend), but no Playwright/`tauri-driver` suite exercises the packaged app.

### Low

12. **Barcode scanning depends on `BarcodeDetector`.** [QrCodeModal.tsx](../src/components/toolbox/QrCodeModal.tsx:104) has no JS fallback, so scanning does not work in WebKit-based webviews (macOS/Linux) and shows an "unsupported environment" message.
13. **No CSP.** [tauri.conf.json](../src-tauri/tauri.conf.json) sets `"csp": null`. The app is offline-first, but a hardening baseline is cheap to add.
14. **No update channels.** The updater reads GitHub `releases/latest`; there is no stable/beta channel or staged rollout.
15. **No database schema versioning.** Redb tables and `AppConfig` have no migration path; the first schema change will need an ad-hoc upgrade.
16. **Toast localization.** Mixed hardcoded English and inline bilingual strings remain in toast titles.
17. **Milestone 1 leftovers.** Per-app hotkeys, clipboard paste, and the file "Open with"/"Properties" actions were specified but never built.

## Candidate 0.2.0 themes

### A. Trusted distribution and updates (recommended)

- Windows Authenticode signing; macOS `codesign` + notarization + stapling.
- Updater verifies the published SHA-256 (or moves to Tauri's signed updater) and pins expected asset names.
- Tighten CSP; add the `hud` window capability (or remove the HUD's core-API usage).
- Build macOS x64, or state arm64-only support explicitly.
- Optional: stable/beta update channels.

Scope: release workflow, updater service, Tauri capabilities/config. Medium effort, highest risk reduction. The macOS artifact is currently blocked by Gatekeeper, and the updater is the one place where a remote artifact is executed.

### B. Observability and diagnostics

- Initialize a `tracing` subscriber with file logging and rotation under the data directory.
- Add a Rust panic hook and a frontend `ErrorBoundary`.
- Add "Export diagnostics" (version, platform, config with secrets redacted, recent logs) to Settings → About.

Scope: small. Makes the 0.1.18/0.1.19 error handling observable and gives support a first response.

### C. Instant file index (flagship feature)

- Persistent index (redb or SQLite) with incremental updates and watcher integration.
- Platform enumerators where available (Windows USN/MFT; FSEvents on macOS; inotify on Linux) with a scan fallback.
- Query against the index with filters, ranking, and drive-aware results.

Scope: large. Fulfills the "disk-speed" claim and Milestone 1 §3.3, and is the clearest user-visible upgrade.

### D. Cross-platform parity

- Tool capability matrix in the toolbox; hide or label Windows-only tools.
- Office document preview (or an explicit "open externally" action) in the built-in QuickLook fallback.
- JS barcode decoder fallback.
- Unify the `Alt+Space` HUD and `Ctrl+K` Spotlight into one federated surface.

Scope: medium. Removes dead ends on macOS/Linux.

### E. Workflow depth

- Clipboard direct-paste action.
- Per-application hotkeys.
- File context menu: Open with, Properties.
- Scheduled backups with retention.

Scope: medium, incremental feature work.

## Recommendation

Ship **A + B** as 0.2.0: they are release-critical, mostly infrastructure, and do not expand the feature surface before the distribution story is sound. Keep **C** as the flagship of 0.2.x or 0.3.0 once trust work lands; **D** and **E** are worthwhile follow-ups that can be split into small PRs.

## Validated claims

- All 17 toolbox entries exist and are registered.
- English and Chinese dictionaries have identical key sets (480 each).
- Clipboard monitoring has a Windows sequence-number fast path and a polling fallback on other platforms.
- Autostart is implemented for Windows, macOS, and Linux.
- The local AI documentation matches the implementation, including pinned archive hashes, loopback binding, and backend fallback.
- CI runs tests and builds on Windows, Ubuntu, and macOS for every PR.
