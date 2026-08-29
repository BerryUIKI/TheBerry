import { safeInvoke } from "./tauri";
import { DownloadProgress, UpdateInfo } from "../types/updater";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export async function checkForUpdates(): Promise<UpdateInfo> {
  return safeInvoke<UpdateInfo>("check_for_updates");
}

export async function downloadAndInstallUpdate(downloadUrl: string): Promise<string> {
  return safeInvoke<string>("download_and_install_update", { downloadUrl });
}

export async function getAppVersion(): Promise<string> {
  return safeInvoke<string>("get_app_version");
}

export async function onUpdateAvailable(callback: (info: UpdateInfo) => void): Promise<UnlistenFn> {
  return listen<UpdateInfo>("app-update-available", (event) => {
    callback(event.payload);
  });
}

export async function onDownloadProgress(callback: (progress: DownloadProgress) => void): Promise<UnlistenFn> {
  return listen<DownloadProgress>("update-download-progress", (event) => {
    callback(event.payload);
  });
}
