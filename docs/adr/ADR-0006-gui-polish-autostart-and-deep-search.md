# ADR-0006: Global UX Polish, Autostart Integration, and Deep Clipboard Search

## Status
Accepted (2026-08-31)

## Context
As TheBerry expanded with more utility modules and background daemons, users required:
1. Smooth visual transitions and unified, non-blocking notification feedback across modules without disruptive `alert()` dialogs.
2. Direct system boot integration (Autostart) so clipboard listeners and hotkey hooks are immediately ready on PC start.
3. Enhanced power-user navigation in the Spotlight HUD (`@`-prefixes, secondary shortcuts).
4. Full-text search and batch capabilities in the redb clipboard persistence layer.

## Decision
1. **Toast Notification Architecture**:
   - Implemented a lightweight SolidJS `ToastContext` and `ToastContainer` with zero external UI framework dependencies.
   - Replaced all legacy `alert()` calls with `success`, `error`, `info`, and `warning` toasts.

2. **Native Cross-Platform Autostart**:
   - On Windows: Direct manipulation of `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` via native `reg.exe` commands.
   - On macOS: Creation and management of user `LaunchAgents` plist files.
   - On Linux: Creation and management of `.config/autostart/*.desktop` entries.
   - Zero additional C-library or runtime dependency overhead.

3. **Spotlight Prefix Routing**:
   - Evaluated regex and token-based prefix parsing (`@app`, `@clip`, `@snip`, `@file`) to restrict federated queries on demand.

4. **Deep redb Search API**:
   - Exposed `search_clipboard_history` IPC command supporting exact text filtering, content type restrictions, and pinned-first ranking.

## Consequences
- Clean, reactive UI with immediate user feedback.
- Reliable autostart on Windows without requiring administrative UAC elevation.
- 100% test coverage for newly introduced modules.
