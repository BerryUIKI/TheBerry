import { safeInvoke } from "./tauri";
import { DownloadProgress, UpdateInfo } from "../types/updater";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export async function checkForUpdates(): Promise<UpdateInfo> {
  return safeInvoke<UpdateInfo>("check_for_updates");
}

export async function downloadUpdate(downloadUrl: string): Promise<string> {
  return safeInvoke<string>("download_update", { downloadUrl });
}

export async function installAndRestart(filePath?: string, silent: boolean = true): Promise<void> {
  return safeInvoke<void>("install_and_restart", { filePath: filePath || null, silent });
}

export async function downloadAndInstallUpdate(downloadUrl: string): Promise<string> {
  return safeInvoke<string>("download_and_install_update", { downloadUrl });
}

export async function getAppVersion(): Promise<string> {
  return safeInvoke<string>("get_app_version");
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0 || !bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  return `${formatBytes(bytesPerSec, 1)}/s`;
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
