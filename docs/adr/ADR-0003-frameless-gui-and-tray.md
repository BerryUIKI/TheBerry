# ADR-0003: Frameless Window, Theme Engine, and System Tray Lifecycle

## Status
Accepted

## Context
Desktop utilities should look modern, sleek, and unintrusive. Native OS window decorations vary across Windows versions and can feel disjointed from custom application themes. Furthermore, a utility suite needs background persistence without cluttering the taskbar.

## Decision
1. **Frameless Window**: Window decorations are disabled (`decorations: false`). A custom SolidJS title bar provides window dragging (`data-tauri-drag-region`), minimize, maximize/restore, close, and theme toggle controls.
2. **System Tray Integration**: The application registers a system tray icon with context menu options ("Show TheBerry", "Quit"). When `close_to_tray` is enabled in `config.toml`, closing the main window hides it to the tray rather than terminating the process.
3. **Theme Management**: Tailwind CSS dark/light classes with custom HSL CSS variables persist user theme preferences across restarts.

## Consequences
- **Positive**:
  - Consistent modern utility aesthetic across operating system versions.
  - Background availability with fast wakeup when clicked in tray.
  - Zero disruption of user workflow when window is closed.
- **Negative**:
  - Native OS window snapping and aero shake behavior must be supported through standard webview drag events.
