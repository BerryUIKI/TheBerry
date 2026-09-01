# QuickLook API Invocation & Protocol Specifications

## 1. Overview
This document defines the Tauri IPC commands, named pipe payload formats, and TypeScript frontend service methods for triggering QuickLook file previews from TheBerry.

---

## 2. Tauri IPC Commands

### 2.1 `get_quicklook_status`
Queries the runtime environment for QuickLook installation, running status, and platform support.

- **Frontend Invocation**:
  ```typescript
  const status: QuickLookStatus = await invoke("get_quicklook_status");
  ```
- **Response Schema**:
  ```typescript
  interface QuickLookStatus {
    is_supported_os: boolean; // true on Windows, false on others
    is_installed: boolean;
    is_running: boolean;
    binary_path: string | null;
    pipe_name: string | null;
    error_message: string | null;
  }
  ```

---

### 2.2 `quicklook_preview`
Toggles or switches the QuickLook preview window for the specified file.

- **Request Payload**:
  ```typescript
  interface QuickLookPreviewPayload {
    path: string;
    mode?: "toggle" | "switch" | "preview"; // default: "toggle"
  }
  ```
- **Frontend Invocation**:
  ```typescript
  await invoke("quicklook_preview", {
    payload: {
      path: "C:\\Users\\User\\Documents\\report.pdf",
      mode: "toggle"
    }
  });
  ```
- **Response**: `boolean` (indicating success or whether preview was dispatched).

---

### 2.3 `quicklook_close`
Closes any active QuickLook preview window.

- **Frontend Invocation**:
  ```typescript
  await invoke("quicklook_close");
  ```
- **Response**: `void`

---

## 3. TypeScript Service Implementation Example

```typescript
import { invoke } from "@tauri-apps/api/core";
import { QuickLookStatus, QuickLookPreviewPayload } from "../types/quicklook";

export class QuickLookService {
  /**
   * Checks if QuickLook is installed, running, and supported on current OS.
   */
  static async getStatus(): Promise<QuickLookStatus> {
    try {
      return await invoke<QuickLookStatus>("get_quicklook_status");
    } catch (e) {
      console.warn("Failed to get QuickLook status:", e);
      return {
        is_supported_os: false,
        is_installed: false,
        is_running: false,
        binary_path: null,
        pipe_name: null,
        error_message: String(e),
      };
    }
  }

  /**
   * Toggles or opens preview for a given file path.
   */
  static async preview(path: string, mode: "toggle" | "switch" = "toggle"): Promise<boolean> {
    if (!path) return false;
    try {
      return await invoke<boolean>("quicklook_preview", {
        payload: { path, mode },
      });
    } catch (err) {
      console.error("QuickLook preview error:", err);
      return false;
    }
  }

  /**
   * Closes active preview window.
   */
  static async close(): Promise<void> {
    try {
      await invoke("quicklook_close");
    } catch (err) {
      console.warn("QuickLook close error:", err);
    }
  }
}
```

---

## 4. UI Keyboard Handler Pattern (SolidJS / React)

```typescript
// Spacebar preview handler for search result items
const handleKeyDown = (e: KeyboardEvent, selectedItemPath?: string) => {
  if (e.code === "Space" && selectedItemPath) {
    const targetTag = (e.target as HTMLElement)?.tagName;
    // Only trigger if not actively typing in an input or textarea
    if (!["INPUT", "TEXTAREA"].includes(targetTag)) {
      e.preventDefault();
      QuickLookService.preview(selectedItemPath);
    }
  }
};
```
