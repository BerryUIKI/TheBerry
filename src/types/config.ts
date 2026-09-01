export interface AppConfig {
  version: string;
  theme: "dark" | "light" | "system";
  language: "en" | "zh";
  close_to_tray: boolean;
  autostart: boolean;
  clipboard_history_limit: number;
  custom_data_dir: string;
}

export interface AppStatusResponse {
  initialized: boolean;
  data_dir: string | null;
  suggested_data_dir: string;
}
