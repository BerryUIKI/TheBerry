import { safeInvoke } from "./tauri";
import { DiscoveredApp, LauncherItem, LauncherPayload } from "../types/launcher";

export async function getLauncherItems(): Promise<LauncherItem[]> {
  return safeInvoke<LauncherItem[]>("get_launcher_items");
}

export async function saveLauncherItem(payload: LauncherPayload): Promise<LauncherItem> {
  return safeInvoke<LauncherItem>("save_launcher_item", { payload });
}

export async function deleteLauncherItem(id: string): Promise<void> {
  return safeInvoke<void>("delete_launcher_item", { id });
}

export async function launchItem(id: string): Promise<void> {
  return safeInvoke<void>("launch_item", { id });
}

export async function discoverSystemApps(): Promise<DiscoveredApp[]> {
  return safeInvoke<DiscoveredApp[]>("discover_system_apps");
}

export async function batchImportLauncherItems(items: DiscoveredApp[]): Promise<number> {
  return safeInvoke<number>("batch_import_launcher_items", { items });
}
