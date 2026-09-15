import { safeInvoke } from "./tauri";
import {
  CompareVariant,
  ComparisonItem,
  ComparisonManifest,
  DeletionVariant,
  PathFilter,
  SyncProfile,
  SyncResult,
  SyncVariant,
} from "../types/folder_sync";

export async function folderSyncCompare(
  leftPath: string,
  rightPath: string,
  compareVariant: CompareVariant,
  syncVariant: SyncVariant,
  filter?: PathFilter
): Promise<ComparisonManifest> {
  return safeInvoke<ComparisonManifest>("folder_sync_compare", {
    leftPath,
    rightPath,
    compareVariant,
    syncVariant,
    filter,
  });
}

export async function folderSyncExecute(
  jobId: string,
  leftPath: string,
  rightPath: string,
  items: ComparisonItem[],
  deletionVariant: DeletionVariant,
  versioningDir?: string | null
): Promise<SyncResult> {
  return safeInvoke<SyncResult>("folder_sync_execute", {
    jobId,
    leftPath,
    rightPath,
    items,
    deletionVariant,
    versioningDir,
  });
}

export async function folderSyncCancel(jobId: string): Promise<boolean> {
  return safeInvoke<boolean>("folder_sync_cancel", { jobId });
}

export async function folderSyncGetProfiles(): Promise<SyncProfile[]> {
  return safeInvoke<SyncProfile[]>("folder_sync_get_profiles");
}

export async function folderSyncSaveProfile(profile: SyncProfile): Promise<SyncProfile> {
  return safeInvoke<SyncProfile>("folder_sync_save_profile", { profile });
}

export async function folderSyncDeleteProfile(profileId: string): Promise<boolean> {
  return safeInvoke<boolean>("folder_sync_delete_profile", { profileId });
}

export async function folderSyncToggleRealtime(profileId: string, enabled: boolean): Promise<boolean> {
  return safeInvoke<boolean>("folder_sync_toggle_realtime", { profileId, enabled });
}

export async function folderSyncGetHistory(limit: number = 20): Promise<SyncResult[]> {
  return safeInvoke<SyncResult[]>("folder_sync_get_history", { limit });
}
