# ADR-0009: QuickLook Windows-Only Preview Integration

## Context
Users navigating files in TheBerry (via File Search, Spotlight HUD, or Clipboard Manager) frequently need instant, native file previews (images, PDFs, source code, Office documents, markdown, archives) without having to launch full external applications.

The **QL-Win/QuickLook** project is the standard open-source quick-look solution on Windows. We need to integrate QuickLook preview capabilities into TheBerry while adhering to strict platform restrictions: the feature must be Windows-only and completely guarded from macOS and Linux builds.

## Decisions

### 1. Windows-Only Platform Restriction & Conditional Compilation
- All QuickLook Rust logic is guarded with `#[cfg(target_os = "windows")]`.
- For macOS and Linux targets (`#[cfg(not(target_os = "windows"))]`), a lightweight stub is compiled that returns a graceful `PlatformNotSupported` response.
- No Windows-specific system calls or named pipe APIs will be compiled into or executed on non-Windows builds.

### 2. Dual-Channel Invocation Protocol (Named Pipe with CLI Fallback)
- **Primary Channel (Windows Named Pipe)**:
  - Pipe format: `\\.\pipe\QuickLook.App.Pipe.<UserSID>`
  - Dynamically resolves the active Windows User SID (e.g. `S-1-5-21-...`) at runtime.
  - Commands supported:
    - `QuickLook.App.PipeMessages.Toggle|<Path>`: Toggle preview open/close.
    - `QuickLook.App.PipeMessages.Switch|<Path>`: Switch existing preview window to target file.
    - `QuickLook.App.PipeMessages.Close|`: Close preview window.
- **Secondary Channel (CLI Fallback)**:
  - If the named pipe is unreachable or QuickLook is not yet running, TheBerry attempts to locate `QuickLook.exe` (via standard installation paths, Windows Store package directories, or PATH) and launches it with the file argument.

### 3. Native Keyboard & UI Interaction (Spacebar Preview)
- Adopting standard desktop preview ergonomics: pressing `Space` on any selected file item in File Search or Spotlight HUD triggers QuickLook preview.
- A dedicated `Eye` / `EyeOff` preview button is provided on file cards for mouse users.
- Pressing `Space` or `Esc` again dismisses the preview window.

## Consequences
- **Positive**:
  - Blazing-fast native preview for hundreds of file formats without embedding heavy rendering engines into TheBerry.
  - Zero performance or compilation impact on non-Windows platforms.
  - Seamless keyboard navigation (Spacebar shortcut) aligned with user muscle memory.
- **Negative / Considerations**:
  - Requires QuickLook to be installed on the user's Windows machine (Store or standalone MSI/ZIP).
  - TheBerry provides detection status and guided install links if QuickLook is not found.
