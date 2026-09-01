export interface QuickLookStatus {
  is_supported_os: boolean;
  is_installed: boolean;
  is_running: boolean;
  binary_path: string | null;
  pipe_name: string | null;
  error_message: string | null;
}

export interface QuickLookPreviewPayload {
  path: string;
  mode?: "toggle" | "switch" | "preview";
}
