export type CompareVariant = "time_and_size" | "content_hash" | "size_only";

export type SyncVariant = "two_way" | "mirror" | "update" | "custom";

export type CompareResult =
  | "equal"
  | "left_only"
  | "right_only"
  | "left_newer"
  | "right_newer"
  | "different_content"
  | "conflict";

export type SyncAction =
  | "copy_left_to_right"
  | "copy_right_to_left"
  | "delete_left"
  | "delete_right"
  | "do_nothing"
  | "conflict";

export type DeletionVariant = "recycle_bin" | "versioning" | "permanent";

export interface PathFilter {
  include_patterns: string[];
  exclude_patterns: string[];
  min_size_bytes?: number | null;
  max_size_bytes?: number | null;
}

export interface FileInfo {
  relative_path: string;
  size_bytes: number;
  modified_timestamp_secs: number;
  is_dir: boolean;
  hash?: string | null;
}

export interface ComparisonItem {
  id: string;
  relative_path: string;
  is_dir: boolean;
  left?: FileInfo | null;
  right?: FileInfo | null;
  compare_result: CompareResult;
  suggested_action: SyncAction;
  action: SyncAction;
}

export interface ComparisonSummary {
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

export interface ComparisonManifest {
  items: ComparisonItem[];
  summary: ComparisonSummary;
}

export interface SyncProfile {
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

export interface SyncProgressEvent {
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

export interface SyncLogEntry {
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface SyncResult {
  job_id: string;
  success: boolean;
  files_copied: number;
  files_deleted: number;
  bytes_transferred: number;
  duration_ms: number;
  errors: string[];
  logs: SyncLogEntry[];
}
