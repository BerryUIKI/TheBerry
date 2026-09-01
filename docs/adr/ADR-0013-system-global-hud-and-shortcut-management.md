# ADR-0013: System-Wide Global HUD & Tray Shortcut Management

## Context
Users need quick access to TheBerry's core productivity tools without needing to switch to the full main application window.
The two primary rapid actions are:
1. **Instant AI Prompting**: Asking questions to 豆花 / TheBerry Agents and receiving live streaming markdown answers.
2. **Fast Local Search**: Searching local files and apps using the `/fin ` prefix with Spacebar native QuickLook preview.

Users also require an option in the Windows System Tray to toggle global shortcut hooks on/off dynamically.

## Decisions
1. **Dedicated Frameless HUD Window**:
   - Add `"hud"` window to `src-tauri/tauri.conf.json` (640x420, frameless, centered, alwaysOnTop, skipTaskbar, visible: false).
   - Auto-hides on `WindowEvent::Focused(false)` (blur) or `Esc` keypress.
2. **Multi-Mode Omni-Input (`HudView.tsx`)**:
   - Default: AI Conversation with streaming markdown rendering and one-click copy.
   - Prefix `/fin ` / `/f `: Local file search and app launcher with arrow-key selection, Enter to open, Space to QuickLook preview.
   - Empty input: Quick Action guide cards.
3. **Global Shortcut Management (`tauri-plugin-global-shortcut`)**:
   - Default hotkey: `Alt+Space`.
   - Dynamic toggle in System Tray right-click context menu.
   - Configuration persisted in `AppConfig.global_shortcuts_enabled` and `AppConfig.hud_shortcut`.

## Consequences
- Clean, fast, native Spotlight / Raycast experience on Windows.
- Unobtrusive system tray management.
