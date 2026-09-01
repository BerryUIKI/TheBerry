# TheBerry Module Interface Document

This document defines the Tauri IPC commands, request payloads, and return data structures for frontend-backend communication.

---

## 1. System & Lifecycle Commands

### `get_app_status`
- **Description**: Returns whether the root data directory is initialized and the suggested path.
- **IPC Command**: `get_app_status`
- **Request Parameters**: None
- **Response**:
  ```typescript
  interface AppStatusResponse {
    initialized: boolean;
    data_dir: string | null;
    suggested_data_dir: string;
  }
  ```

### `initialize_data_dir`
- **Description**: Configures and initializes the user-chosen root data directory, creates `config.toml` and opens `redb`.
- **IPC Command**: `initialize_data_dir`
- **Request Parameters**:
  ```typescript
  { customDataDir: string }
  ```
- **Response**: `AppConfig`

### `get_config` / `update_config`
- **Description**: Read and update application configuration.
- **IPC Commands**: `get_config`, `update_config`
- **Payload (`update_config`)**:
  ```typescript
  interface AppConfig {
    version: string;
    theme: "dark" | "light" | "system";
    close_to_tray: boolean;
    autostart: boolean;
    clipboard_history_limit: number;
    custom_data_dir: string;
  }
  ```

---

## 2. Window Control Commands

| Command | Arguments | Return | Description |
| :--- | :--- | :--- | :--- |
| `minimize_window` | None | `void` | Minimizes frameless window |
| `toggle_maximize_window` | None | `boolean` | Toggles window maximize/restore state |
| `close_window` | None | `void` | Hides to tray or exits depending on config |
| `show_main_window` | None | `void` | Focuses and reveals main window from tray |

---

## 3. Clipboard History Module (`modules::clipboard`)

### Data Structure
```typescript
interface ClipboardItem {
  id: string;
  content_type: "text" | "image" | "file" | "html";
  content: string;
  preview: string;
  is_pinned: boolean;
  char_count: number;
  created_at: string; // ISO 8601 UTC
}
```

### Commands
- `get_clipboard_history()`: `ClipboardItem[]`
- `add_clipboard_item(content: string, contentType?: string)`: `ClipboardItem`
- `toggle_clipboard_pin(id: string)`: `ClipboardItem`
- `delete_clipboard_item(id: string)`: `void`
- `clear_clipboard_history()`: `number` (count of cleared items)
- `copy_to_system_clipboard(content: string)`: `void` (writes text directly into OS clipboard)

### Events
- `clipboard-updated`: Emitted whenever background OS clipboard change is captured.

---

## 4. Code Snippets Module (`modules::snippets`)

### Data Structure
```typescript
interface SnippetItem {
  id: string;
  title: string;
  description: string;
  content: string;
  language: string;
  category: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface SnippetPayload {
  id?: string;
  title: string;
  description?: string;
  content: string;
  language?: string;
  category?: string;
  tags?: string[];
  is_favorite?: boolean;
}
```

### Commands
- `get_snippets()`: `SnippetItem[]`
- `save_snippet(payload: SnippetPayload)`: `SnippetItem`
- `delete_snippet(id: string)`: `void`

---

## 5. Application Launcher Module (`modules::launcher`)

### Data Structure
```typescript
interface LauncherItem {
  id: string;
  name: string;
  description: string;
  exec_path: string;
  arguments: string[];
  working_dir?: string | null;
  category: string;
  is_favorite: boolean;
  is_batch: boolean;
  batch_commands: string[];
  launch_count: number;
  created_at: string;
  updated_at: string;
}

interface LauncherPayload {
  id?: string;
  name: string;
  description?: string;
  exec_path: string;
  arguments?: string[];
  working_dir?: string;
  category?: string;
  is_favorite?: boolean;
  is_batch?: boolean;
  batch_commands?: string[];
}
```

### Commands
- `get_launcher_items()`: `LauncherItem[]`
- `save_launcher_item(payload: LauncherPayload)`: `LauncherItem`
- `delete_launcher_item(id: string)`: `void`
- `launch_item(id: string)`: `string`

---

## 6. Batch Image Converter Module (`modules::image_converter`)

### Data Structure
```typescript
interface ConvertTask {
  source_path: string;
  target_format: "png" | "jpeg" | "webp";
  quality?: number; // 1-100
  output_dir?: string;
}

interface ConvertResult {
  source_path: string;
  output_path: string | null;
  original_size_bytes: number;
  converted_size_bytes: number | null;
  success: boolean;
  error_message: string | null;
}
```

### Commands
- `convert_images(tasks: ConvertTask[])`: `Promise<ConvertResult[]>`

---

## 7. Fast File Search Module (`modules::file_search`)

### Data Structure
```typescript
interface SearchQuery {
  pattern: string;
  search_root?: string;
  max_results?: number;
  file_type_filter?: "all" | "file" | "dir" | "image" | "doc" | "code";
  case_sensitive?: boolean;
}

interface SearchResultItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  extension: string;
  modified_time: number; // Unix timestamp
}
```

### Commands
- `search_files(query: SearchQuery)`: `Promise<SearchResultItem[]>`
- `get_system_drives()`: `Promise<SystemDrive[]>`
- `reveal_in_explorer(path: string)`: `Promise<void>`

---

## 8. Goose AI Assistant Module (`modules::goose`)

### Data Structures
```typescript
interface GooseStatus {
  is_running: boolean;
  is_installed: boolean;
  binary_path: string | null;
  port: number | null;
  active_model: string | null;
  active_provider: string | null;
  error_message: string | null;
}

interface SendGooseMessagePayload {
  session_id: string;
  prompt: string;
  model?: string;
  provider?: string;
}

interface GooseStreamChunk {
  session_id: string;
  message_id: string;
  delta: string;
  is_finished: boolean;
  error?: string;
}
```

### Commands
- `get_goose_status()`: `Promise<GooseStatus>`
- `start_goose_daemon(customPort?: number)`: `Promise<GooseStatus>`
- `stop_goose_daemon()`: `Promise<void>`
- `send_goose_message(payload: SendGooseMessagePayload)`: `Promise<void>`

### Events
- `goose://stream-chunk`: Emitted continuously as new tokens arrive from the local Goose SSE stream.
- `goose://status-change`: Emitted when the Goose daemon state changes.

