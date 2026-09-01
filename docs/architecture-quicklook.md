# Architecture Design Document: QuickLook Windows-Only Preview Integration

## 1. Overview
This document specifies the technical architecture for integrating the **QL-Win/QuickLook** file preview engine into **TheBerry** personal desktop utility suite on Windows.

---

## 2. Architecture & Component Boundary

```mermaid
graph TD
    subgraph UI ["SolidJS Frontend Layer (src/)"]
        FileSearchView["File Search View (Space / Preview Button)"]
        SpotlightHUD["Spotlight Modal (Space / Preview Button)"]
        ClipboardView["Clipboard View (File Preview Trigger)"]
        QLService["TypeScript IPC Service (quicklook.ts)"]
    end

    subgraph TauriIPC ["Tauri v2 IPC Commands"]
        CmdPreview["quicklook_preview(path, mode)"]
        CmdStatus["get_quicklook_status()"]
        CmdClose["quicklook_close()"]
    end

    subgraph RustBackend ["Rust Backend (src-tauri/src/modules/quicklook/)"]
        QLMod["modules::quicklook"]

        subgraph WindowsImplementation ["#[cfg(target_os = 'windows')]"]
            SIDResolver["User SID Resolver (advapi32 / whoami)"]
            NamedPipe["Named Pipe Client (\\.\\pipe\\QuickLook.App.Pipe.<SID>)"]
            ProcessLauncher["CLI Process Launcher Fallback (QuickLook.exe)"]
            Detector["Environment & Process Detector"]
        end

        subgraph NonWindowsStub ["#[cfg(not(target_os = 'windows'))]"]
            Stub["PlatformNotSupported Return"]
        end
    end

    subgraph QuickLookHost ["External QuickLook Application"]
        PipeListener["Named Pipe Listener (:QuickLook.App.Pipe.<SID>)"]
        PreviewRenderer["Native QuickLook Preview Window (DirectX / WPF)"]
    end

    FileSearchView -->|Space / Click| QLService
    SpotlightHUD -->|Space / Click| QLService
    ClipboardView -->|Space / Click| QLService
    QLService --> CmdPreview
    QLService --> CmdStatus
    QLService --> CmdClose

    CmdPreview --> QLMod
    CmdStatus --> QLMod
    CmdClose --> QLMod

    QLMod -->|Windows| NamedPipe
    QLMod -->|Windows| ProcessLauncher
    QLMod -->|Non-Windows| Stub

    NamedPipe -->|'QuickLook.App.PipeMessages.Toggle|Path'| PipeListener
    ProcessLauncher -->|Spawn QuickLook.exe| QuickLookHost
    PipeListener --> PreviewRenderer
```

---

## 3. Communication Layer & Named Pipe Protocol

### 3.1 Named Pipe Format
QuickLook binds to a user-scoped named pipe on Windows:
```text
\\.\pipe\QuickLook.App.Pipe.<USER_SID>
```
Where `<USER_SID>` is the security identifier of the current logged-in Windows user (e.g. `S-1-5-21-3623811015-3361044348-30300820-1013`).

### 3.2 Message Structure
Messages sent to the pipe are plain UTF-8 strings formatted as:
```text
<CommandName>|<FilePath>
```

| Message Name | Parameter | Description |
| :--- | :--- | :--- |
| `QuickLook.App.PipeMessages.Toggle` | `<AbsolutePath>` | Toggles the preview window. If closed, opens preview for file. If already open on this file, closes it. If open on different file, switches to this file. |
| `QuickLook.App.PipeMessages.Switch` | `<AbsolutePath>` | Immediately updates the preview window to display the target file. |
| `QuickLook.App.PipeMessages.Close` | `""` | Closes any active QuickLook preview window. |

### 3.3 Pipe Writer Implementation
1. The client opens the named pipe path using standard file open / named pipe connect APIs with a 500ms timeout.
2. The formatted message string followed by a newline is written and flushed.
3. The pipe connection is closed immediately after write completion.

---

## 4. Platform Guarding & Conditional Compilation

To strictly enforce the **Windows-Only** requirement:
- **Rust Backend**:
  ```rust
  #[cfg(target_os = "windows")]
  mod windows;
  #[cfg(not(target_os = "windows"))]
  mod stub;
  ```
  On non-Windows platforms, only `stub.rs` is compiled. It provides zero-overhead no-op implementations returning `QuickLookStatus { is_available: false, is_running: false, is_supported_os: false, ... }`.
- **Frontend Layer**:
  - `getQuickLookStatus()` checks `is_supported_os`. When false, preview shortcuts and buttons remain gracefully dormant without throwing errors.
