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
    language: "en" | "zh";
    close_to_tray: boolean;
    autostart: boolean;
    global_shortcuts_enabled: boolean;
    hud_shortcut: string;
    clipboard_history_limit: number;
    custom_data_dir: string;
  }
  ```

---

## 2. Window Control & Shortcuts Commands

| Command | Arguments | Return | Description |
| :--- | :--- | :--- | :--- |
| `minimize_window` | None | `void` | Minimizes frameless window |
| `toggle_maximize_window` | None | `boolean` | Toggles window maximize/restore state |
| `close_window` | None | `void` | Hides to tray or exits depending on config |
| `show_main_window` | None | `void` | Focuses and reveals main window from tray |
| `toggle_hud_window` | `show?: boolean` | `void` | Toggles or sets visibility of the global HUD window |
| `resize_hud_window` | `height: number` | `void` | Smoothly resizes the HUD window logical height |
| `set_global_shortcuts_enabled` | `enabled: boolean` | `void` | Enables or disables all registered global shortcuts dynamically |
| `set_hud_shortcut` | `shortcut: string` | `void` | Sets and registers custom global hotkey for Quick Access HUD |

---

## 3. Autostart Module (`modules::autostart`)

### Commands
- `is_autostart_enabled()`: `boolean`
- `set_autostart(enabled: boolean)`: `void`

---

## 4. Clipboard History Module (`modules::clipboard`)

### Data Structure
```typescript
interface ClipboardItem {
  id: string;
  content_type: string; // "text" | "image" | "file" | "json"
  content: string;
  preview: string;
  media_path?: string;
  media_data_url?: string;
  image_width?: number;
  image_height?: number;
  is_pinned: boolean;
  char_count: number;
  created_at: string; // ISO 8601 UTC
}
```

### Commands
- `get_clipboard_history()`: `ClipboardItem[]`
- `search_clipboard_history(query: string, contentType?: string, isPinned?: boolean, limit?: number)`: `ClipboardItem[]`
- `add_clipboard_item(content: string, contentType?: string)`: `ClipboardItem`
- `toggle_clipboard_pin(id: string)`: `ClipboardItem`
- `delete_clipboard_item(id: string)`: `void`
- `clear_clipboard_history()`: `number` (count of cleared items)
- `copy_to_system_clipboard(content: string)`: `void` (writes text directly into OS clipboard)
- `copy_image_to_system_clipboard(path: string)`: `void` (writes image directly into OS clipboard)

### Events
- `clipboard-updated`: Emitted whenever background OS clipboard change is captured.

---

## 5. Code Snippets Module (`modules::snippets`)

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
- `expand_snippet_template(content: string)`: `string`
- `copy_expanded_snippet(content: string)`: `void`

---

## 6. Application Launcher Module (`modules::launcher`)

### Data Structure
```typescript
interface LauncherItem {
  id: string;
  name: string;
  description: string;
  exec_path: string;
  arguments: string[];
  working_dir?: string;
  category: string;
  icon_path?: string;
  is_favorite: boolean;
  launch_count: number;
  is_batch: boolean;
  batch_commands: string[];
  created_at: string;
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

interface DiscoveredApp {
  name: string;
  exec_path: string;
  category: string;
  icon_hint?: string;
}
```

### Commands
- `get_launcher_items()`: `LauncherItem[]`
- `save_launcher_item(payload: LauncherPayload)`: `LauncherItem`
- `delete_launcher_item(id: string)`: `void`
- `launch_item(id: string)`: `string`
- `discover_system_apps()`: `DiscoveredApp[]`
- `batch_import_launcher_items(items: LauncherPayload[])`: `number`

---

## 7. Batch Image Converter Module (`modules::image_converter`)

### Data Structure
```typescript
interface ConvertTask {
  source_path: string;
  target_format: "webp" | "jpeg" | "png";
  quality: number; // 1-100
  output_dir?: string;
  resize_width?: number;
  resize_height?: number;
  preserve_aspect_ratio?: boolean;
}

interface ConvertResult {
  source_path: string;
  target_path: string;
  original_size_bytes: number;
  converted_size_bytes: number;
  success: boolean;
  error_message?: string;
  width: number;
  height: number;
}
```

### Commands
- `convert_images(tasks: ConvertTask[])`: `Promise<ConvertResult[]>`

---

## 8. Fast File Search Module (`modules::file_search`)

### Data Structure
```typescript
interface SearchQuery {
  pattern: string;
  search_root?: string;
  max_results?: number;
  max_depth?: number;
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

interface SystemDrive {
  name: string;
  path: string;
}
```

### Commands
- `search_files(query: SearchQuery)`: `Promise<SearchResultItem[]>`
- `get_system_drives()`: `Promise<SystemDrive[]>`
- `reveal_in_explorer(path: string)`: `Promise<void>`
- `open_file_path(path: string)`: `Promise<void>`

---

## 9. Updater Module (`modules::updater`)

### Data Structures
```typescript
interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_notes: string;
  release_url: string;
  download_url?: string;
  asset_name?: string;
  published_at?: string;
}

interface DownloadProgress {
  bytes_downloaded: number;
  total_bytes?: number;
  percent: number;
  speed_bytes_per_sec?: number;
  done: boolean;
  status: string;
  file_path?: string;
}
```

### Commands
- `check_for_updates()`: `Promise<UpdateInfo>`
- `download_update(downloadUrl: string)`: `Promise<string>`
- `install_and_restart(filePath?: string, silent?: boolean)`: `Promise<void>`
- `download_and_install_update(downloadUrl: string)`: `Promise<string>` (legacy compatibility)
- `get_app_version()`: `Promise<string>`

### Events
- `update-download-progress`: Emitted continuously with `DownloadProgress` payload during streaming download directly into the `<data_dir>/updates/` cache.
- `app-update-available`: Emitted with `UpdateInfo` payload when background check detects a newer release.

---

## 10. Backup & Restore Module (`modules::backup`)

### Commands
- `export_full_backup(targetPath: string)`: `Promise<string>`
- `import_full_backup(backupZipPath: string)`: `Promise<boolean>`

---

## 11. Goose AI Assistant Module (`modules::goose`)

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
  error?: string | null;
}

export type AIRequestFormat = "openai" | "anthropic" | "gemini" | "ollama" | "custom";

interface AIConfig {
  active_provider: "openai" | "anthropic" | "gemini" | "ollama" | "deepseek" | "groq" | "openrouter" | "custom";
  request_format: AIRequestFormat;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  language: "en" | "zh";
  user_name: string;
  user_avatar: string;
  enable_developer_tools: boolean;
  enable_web_fetch: boolean;
  custom_mcp_servers: Array<{
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
  }>;
  goose_binary_path: string;
  auto_start_daemon: boolean;
}
```

### Commands
- `get_goose_status()`: `Promise<GooseStatus>`
- `start_goose_daemon(customPort?: number)`: `Promise<GooseStatus>`
- `stop_goose_daemon()`: `Promise<void>`
- `send_goose_message(payload: SendGooseMessagePayload)`: `Promise<void>`
- `set_goose_custom_binary_path(path: string)`: `Promise<void>`
- `get_ai_config()`: `Promise<AIConfig>`
- `save_ai_config(config: AIConfig)`: `Promise<void>`
- `fetch_provider_models(provider: string, baseUrl?: string, apiKey?: string, requestFormat?: string)`: `Promise<string[]>`

### Events
- `goose-stream-chunk`: Emitted continuously as new tokens arrive from the local Goose SSE stream.
- `goose-status-change`: Emitted when the Goose daemon state changes.

---

## 12. QuickLook Preview Module (`modules::quicklook` - Windows Only)

### Data Structures
```typescript
interface QuickLookStatus {
  is_supported_os: boolean; // true on Windows, false on macOS/Linux
  is_installed: boolean;
  is_running: boolean;
  binary_path: string | null;
  pipe_name: string | null;
  error_message: string | null;
}

interface QuickLookPreviewPayload {
  path: string;
  mode?: "toggle" | "switch" | "preview";
}
```

### Commands
- `get_quicklook_status()`: `Promise<QuickLookStatus>`
- `quicklook_preview(payload: QuickLookPreviewPayload)`: `Promise<boolean>`
- `quicklook_close()`: `Promise<void>`

---

## 13. Folder Sync Module (`modules::folder_sync`)

### Data Structures
```typescript
type CompareVariant = "time_and_size" | "content_hash" | "size_only";
type SyncVariant = "two_way" | "mirror" | "update" | "custom";
type CompareResult = "equal" | "left_only" | "right_only" | "left_newer" | "right_newer" | "different_content" | "conflict";
type SyncAction = "copy_left_to_right" | "copy_right_to_left" | "delete_left" | "delete_right" | "do_nothing" | "conflict";
type DeletionVariant = "recycle_bin" | "versioning" | "permanent";

interface PathFilter {
  include_patterns: string[];
  exclude_patterns: string[];
  min_size_bytes?: number | null;
  max_size_bytes?: number | null;
}

interface FileInfo {
  relative_path: string;
  size_bytes: number;
  modified_timestamp_secs: number;
  is_dir: boolean;
  hash?: string | null;
}

interface ComparisonItem {
  id: string;
  relative_path: string;
  is_dir: boolean;
  left?: FileInfo | null;
  right?: FileInfo | null;
  compare_result: CompareResult;
  suggested_action: SyncAction;
  action: SyncAction;
}

interface ComparisonSummary {
  total_items: number;
  equal_items: number;
  left_only_items: number;
  right_only_items: number;
  different_items: number;
  conflict_items: number;
  bytes_to_transfer_l2r: number;
  bytes_to_transfer_r2l: number;
  items_to_delete_right: number;
  items_to_delete_left: number;
}

interface ComparisonManifest {
  items: ComparisonItem[];
  summary: ComparisonSummary;
}

interface SyncProfile {
  id: string;
  name: string;
  left_path: string;
  right_path: string;
  sync_variant: SyncVariant;
  compare_variant: CompareVariant;
  deletion_variant: DeletionVariant;
  versioning_dir?: string | null;
  filter: PathFilter;
  realtime_enabled: boolean;
  realtime_debounce_secs: number;
  last_sync_timestamp?: number | null;
  created_at: number;
  updated_at: number;
}

interface SyncProgressEvent {
  job_id: string;
  current_file: string;
  items_processed: number;
  total_items: number;
  bytes_processed: number;
  total_bytes: number;
  speed_bytes_per_sec: number;
  stage: "scanning" | "comparing" | "syncing" | "completed" | "failed" | "canceled";
  message: string;
}
```

### Commands
- `folder_sync_compare(left_path: string, right_path: string, compare_variant: CompareVariant, sync_variant: SyncVariant, filter?: PathFilter)`: `Promise<ComparisonManifest>`
- `folder_sync_execute(job_id: string, left_path: string, right_path: string, items: ComparisonItem[], deletion_variant: DeletionVariant, versioning_dir?: string)`: `Promise<SyncResult>`
- `folder_sync_cancel(job_id: string)`: `Promise<boolean>`
- `folder_sync_get_profiles()`: `Promise<SyncProfile[]>`
- `folder_sync_save_profile(profile: SyncProfile)`: `Promise<SyncProfile>`
- `folder_sync_delete_profile(profile_id: string)`: `Promise<boolean>`
- `folder_sync_toggle_realtime(profile_id: string, enabled: boolean)`: `Promise<boolean>`

### Events
- `folder-sync-progress`: Emitted during folder comparison and synchronization execution with `SyncProgressEvent` metrics.

---

## 14. Toolbox Utilities Module (`modules::toolbox`)

### Data Structures
```typescript
interface FileChecksums {
  file_path: string;
  file_name: string;
  file_size: number;
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}

interface RenameItem {
  original_path: string;
  new_path: string;
}

interface BatchRenameResult {
  total: number;
  success_count: number;
  failure_count: number;
  errors: string[];
}
```

### Commands
- `calculate_file_hash(path: string)`: `Promise<FileChecksums>`
- `batch_rename_files(items: RenameItem[])`: `Promise<BatchRenameResult>`

---

## 15. Navigation & Layout Customization (`services::navigation`)

### Data Structures
```typescript
interface NavItemConfig {
  id: string;
  customName?: string;
  hidden: boolean;
  order: number;
}

interface NavigationState {
  sidebarItems: NavItemConfig[];
  toolboxOrder: string[];
}
```

### Storage & Event Sync
- **Local Storage Key**: `the_berry_navigation_config`
- **Synchronization Event**: `navigation-state-changed` (CustomEvent dispatched across components on reordering, hiding, renaming, or resetting)
- **Three-Tier Hidden Items Depot**:
  1. *Sidebar Stored Utilities Drawer*: Collapsible popover displaying hidden utilities with click-to-restore toggles.
  2. *Toolbox Master Depot*: Toolbox hub card grid with pin/unpin toggles (`Pin`/`PinOff`) directly linking sidebar navigation visibility.
  3. *Navigation Manager Modal*: Global management modal to reorder items, customize aliases, and toggle visibility.
