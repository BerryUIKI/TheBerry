import { safeInvoke } from "./tauri";
import { AppConfig, AppStatusResponse } from "../types/config";

export async function getAppStatus(): Promise<AppStatusResponse> {
  return safeInvoke<AppStatusResponse>("get_app_status");
}

export async function initializeDataDir(customDataDir: string): Promise<AppConfig> {
  return safeInvoke<AppConfig>("initialize_data_dir", { customDataDir });
}

export async function getConfig(): Promise<AppConfig> {
  return safeInvoke<AppConfig>("get_config");
}

export async function updateConfig(config: AppConfig): Promise<AppConfig> {
  return safeInvoke<AppConfig>("update_config", { config });
}

export async function minimizeWindow(): Promise<void> {
  return safeInvoke<void>("minimize_window");
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  return safeInvoke<boolean>("toggle_maximize_window");
}

export async function closeWindow(): Promise<void> {
  return safeInvoke<void>("close_window");
}
