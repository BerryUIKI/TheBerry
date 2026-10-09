export interface QuickLookStatus {
  is_supported_os: boolean;
  is_installed: boolean;
  is_running: boolean;
  is_enabled: boolean;
  is_embedded: boolean;
  has_builtin_fallback: boolean;
  binary_path: string | null;
  pipe_name: string | null;
  error_message: string | null;
}

export interface QuickLookPreviewPayload {
  path: string;
  mode?: "toggle" | "switch" | "preview";
}

export type PreviewCategory =
  | "image"
  | "video"
  | "audio"
  | "code"
  | "markdown"
  | "pdf"
  | "csv"
  | "text"
  | "binary";

export interface FilePreviewInfo {
  path: string;
  name: string;
  extension: string;
  size_bytes: number;
  modified_timestamp: number | null;
  mime_type: string;
  category: PreviewCategory;
  text_preview: string | null;
  base64_data: string | null;
  is_truncated: boolean;
}
