export interface SearchResultItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
  extension: string;
  modified_time: number;
}

export interface SearchQuery {
  pattern: string;
  search_root?: string;
  max_results?: number;
  max_depth?: number;
  file_type_filter?: "all" | "file" | "dir" | "image" | "doc" | "code";
  case_sensitive?: boolean;
}

export interface SystemDrive {
  name: string;
  mount_point: string;
}
