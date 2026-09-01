# ADR-0013: System-Wide Global HUD & Tray Shortcut Management

## Context
Users require instant accessibility to TheBerry's core productivity features from anywhere in the operating system without switching focus to the main application window.
The two primary rapid-action workflows are:
1. **Instant AI Conversation**: Rapidly asking questions or seeking assistance from the assistant (豆花 / TheBerry Agents) with live streaming markdown answers.
2. **Local Search**: Fast file, folder, and app search via `/fin ` prefix with instant launch and Spacebar QuickLook preview.

Additionally, users need a fast, non-intrusive way in the Windows System Tray to toggle global shortcut hooks on/off to avoid hotkey collisions with full-screen games or specific applications.

## Decisions

### 1. Dedicated Lightweight HUD Window Architecture
In `src-tauri/tauri.conf.json`, declare a secondary window labeled `"hud"`:
- `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `visible: false`, `center: true`.
- Window lifecycle:
  - Global hotkey press (`Alt+Space`) triggers instant show, unminimize, and center focus.
  - On focus loss (`WindowEvent::Focused(false)`) or `Esc` keypress, the HUD window hides automatically.

### 2. Multi-Mode Omni-Input (`HudView.tsx`)
A unified single dialog with intelligent intent switching:
- **Default Mode (AI Prompt)**:
  - Accepts arbitrary prompt and streams response directly within the HUD using `<MarkdownContent />`.
- **Search Mode (`/fin <query>` or `/f <query>`)**:
  - Automatically activates local multi-drive file search and app launcher matches.
  - Keyboard-driven selection (Arrow Up/Down, Enter to open, Space to QuickLook preview).

### 3. Global Shortcut Engine & System Tray Toggle
- Integrate `tauri-plugin-global-shortcut` with default binding `Alt+Space`.
- Extend `AppConfig`:
  - `global_shortcuts_enabled: bool` (default: `true`)
  - `hud_shortcut: String` (default: `"Alt+Space"`)
- System Tray Context Menu:
  - Right-click menu contains dynamic toggle item: `[✓] Global Shortcuts Enabled` / `[✓] 启用全局快捷键`.
  - Toggling reconfigures the global shortcut hook in real time.

## Consequences
- **Positive**:
  - True OS-level Raycast/Spotlight equivalent on Windows.
  - Zero disruption to background workflows.
  - Seamless toggle capability via System Tray.
