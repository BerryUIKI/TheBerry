import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  ArrowLeftRight,
  GitCompare,
  Play,
  RotateCw,
  SlidersHorizontal,
  FolderSync as FolderSyncIcon,
  Sparkles,
  HelpCircle,
} from "lucide-solid";
import { listen } from "@tauri-apps/api/event";
import {
  CompareVariant,
  ComparisonItem,
  ComparisonManifest,
  DeletionVariant,
  PathFilter,
  SyncAction,
  SyncProfile,
  SyncProgressEvent,
  SyncResult,
  SyncVariant,
} from "../types/folder_sync";
import {
  folderSyncCancel,
  folderSyncCompare,
  folderSyncExecute,
  folderSyncGetProfiles,
  folderSyncSaveProfile,
} from "../services/folderSync";
import { useToast } from "../context/ToastContext";
import { FolderPairBar } from "../components/folder_sync/FolderPairBar";
import { SyncModeTabs } from "../components/folder_sync/SyncModeTabs";
import { ComparisonDiffTable } from "../components/folder_sync/ComparisonDiffTable";
import { SyncProgressModal } from "../components/folder_sync/SyncProgressModal";
import { FilterSettingsModal } from "../components/folder_sync/FilterSettingsModal";
import { VersioningSettingsModal } from "../components/folder_sync/VersioningSettingsModal";
import { SavedProfilesModal } from "../components/folder_sync/SavedProfilesModal";

export function FolderSyncView() {
  const { success, error, info } = useToast();

  // Paths
  const [leftPath, setLeftPath] = createSignal("");
  const [rightPath, setRightPath] = createSignal("");

  // Sync parameters
  const [syncVariant, setSyncVariant] = createSignal<SyncVariant>("two_way");
  const [compareVariant, setCompareVariant] = createSignal<CompareVariant>("time_and_size");
  const [deletionVariant, setDeletionVariant] = createSignal<DeletionVariant>("recycle_bin");
  const [versioningDir, setVersioningDir] = createSignal("");
  const [filter, setFilter] = createSignal<PathFilter>({
    include_patterns: ["*"],
    exclude_patterns: [
      "*.tmp",
      "~$*",
      ".git/*",
      "node_modules/*",
      ".DS_Store",
      "Thumbs.db",
      "desktop.ini",
    ],
    min_size_bytes: null,
    max_size_bytes: null,
  });

  // State
  const [manifest, setManifest] = createSignal<ComparisonManifest | null>(null);
  const [isComparing, setIsComparing] = createSignal(false);
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [currentJobId, setCurrentJobId] = createSignal<string>("");
  const [syncProgress, setSyncProgress] = createSignal<SyncProgressEvent | null>(null);
  const [syncResult, setSyncResult] = createSignal<SyncResult | null>(null);

  // Modals
  const [isProgressOpen, setIsProgressOpen] = createSignal(false);
  const [isFilterOpen, setIsFilterOpen] = createSignal(false);
  const [isVersioningOpen, setIsVersioningOpen] = createSignal(false);
  const [isProfilesOpen, setIsProfilesOpen] = createSignal(false);

  // Saved profiles
  const [profiles, setProfiles] = createSignal<SyncProfile[]>([]);

  const loadProfiles = async () => {
    try {
      const list = await folderSyncGetProfiles();
      setProfiles(list);
    } catch (e) {
      console.error("Failed to load profiles", e);
    }
  };

  onMount(() => {
    loadProfiles();

    let unlistenProgress: (() => void) | null = null;
    let unlistenRealtime: (() => void) | null = null;

    listen<SyncProgressEvent>("folder-sync-progress", (event) => {
      setSyncProgress(event.payload);
    }).then((un) => {
      unlistenProgress = un;
    });

    listen<string>("folder-sync-realtime-triggered", (event) => {
      info("RealTimeSync 自动触发", `方案 [${event.payload}] 检测到文件变动，即将自动同步`);
      // Auto run compare & sync if matching current paths
      handleCompare();
    }).then((un) => {
      unlistenRealtime = un;
    });

    onCleanup(() => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenRealtime) unlistenRealtime();
    });
  });

  const handleSwapPaths = () => {
    const l = leftPath();
    setLeftPath(rightPath());
    setRightPath(l);
    setManifest(null);
  };

  const handleCompare = async () => {
    const l = leftPath().trim();
    const r = rightPath().trim();
    if (!l || !r) {
      error("请选择文件夹", "请配置有效的左侧（源）与右侧（目标）文件夹路径");
      return;
    }

    setIsComparing(true);
    try {
      const res = await folderSyncCompare(l, r, compareVariant(), syncVariant(), filter());
      setManifest(res);
      success(
        "比对完成",
        `共找到 ${res.summary.total_items} 项，${res.summary.total_items - res.summary.equal_items} 项存在变更`
      );
    } catch (e) {
      error("比对失败", String(e));
    } finally {
      setIsComparing(false);
    }
  };

  const handleExecuteSync = async () => {
    const m = manifest();
    if (!m || m.items.length === 0) {
      error("无法同步", "请先执行比对并确认待同步项");
      return;
    }

    const jobId = "job_" + Date.now();
    setCurrentJobId(jobId);
    setSyncProgress(null);
    setSyncResult(null);
    setIsExecuting(true);
    setIsProgressOpen(true);

    try {
      const res = await folderSyncExecute(
        jobId,
        leftPath(),
        rightPath(),
        m.items,
        deletionVariant(),
        versioningDir() || null
      );
      setSyncResult(res);
      if (res.success) {
        success("同步已完成", `成功传输 ${res.files_copied} 个文件，删除 ${res.files_deleted} 个文件`);
        // Refresh comparison
        handleCompare();
      } else {
        error("同步未完全成功", `遇到了 ${res.errors.length} 个错误，请查看详情`);
      }
    } catch (e) {
      error("同步异常", String(e));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelSync = async () => {
    const jId = currentJobId();
    if (jId) {
      await folderSyncCancel(jId);
    }
  };

  const handleItemActionChange = (itemId: string, newAction: SyncAction) => {
    const currentManifest = manifest();
    if (!currentManifest) return;

    const updatedItems = currentManifest.items.map((it) => {
      if (it.id === itemId) {
        return { ...it, action: newAction };
      }
      return it;
    });

    setManifest({
      ...currentManifest,
      items: updatedItems,
    });
  };

  const handleSelectProfile = (p: SyncProfile) => {
    setLeftPath(p.left_path);
    setRightPath(p.right_path);
    setSyncVariant(p.sync_variant);
    setCompareVariant(p.compare_variant);
    setDeletionVariant(p.deletion_variant);
    setVersioningDir(p.versioning_dir || "");
    setFilter(p.filter);
    setManifest(null);
    success("方案已载入", `已应用方案: ${p.name}`);
  };

  const handleSaveCurrentAsProfile = async (name: string) => {
    const newProfile: SyncProfile = {
      id: "profile_" + Date.now(),
      name,
      left_path: leftPath(),
      right_path: rightPath(),
      sync_variant: syncVariant(),
      compare_variant: compareVariant(),
      deletion_variant: deletionVariant(),
      versioning_dir: versioningDir() || null,
      filter: filter(),
      realtime_enabled: false,
      realtime_debounce_secs: 10,
      last_sync_timestamp: null,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    };

    try {
      await folderSyncSaveProfile(newProfile);
      success("保存成功", `任务方案 [${name}] 已成功持久化`);
      loadProfiles();
    } catch (e) {
      error("保存失败", String(e));
    }
  };

  return (
    <div class="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden select-none bg-background">
      {/* View Header */}
      <div class="flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <FolderSyncIcon size={22} />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold text-foreground">文件夹同步与比对</h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-medium border border-primary/20">
                FreeFileSync Core
              </span>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5">
              双向、镜像及增量同步，支持多线程哈希比对、安全版本控制与 RealTimeSync 实时监控
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div class="flex items-center gap-2.5">
          <button
            onClick={handleCompare}
            disabled={isComparing() || isExecuting() || !leftPath() || !rightPath()}
            class="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl text-xs transition-all shadow-xs disabled:opacity-50"
          >
            <GitCompare size={15} class={isComparing() ? "animate-spin text-primary" : "text-primary"} />
            <span>{isComparing() ? "正在扫描比对..." : "开始比对 (Compare)"}</span>
          </button>

          <button
            onClick={handleExecuteSync}
            disabled={
              isExecuting() ||
              isComparing() ||
              !manifest() ||
              manifest()!.items.length === 0
            }
            class="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs transition-all shadow-sm hover:shadow-md disabled:opacity-50"
          >
            <Play size={15} />
            <span>执行同步 (Synchronize)</span>
          </button>
        </div>
      </div>

      {/* Folder Pair Inputs */}
      <div class="flex-shrink-0">
        <FolderPairBar
          leftPath={leftPath()}
          rightPath={rightPath()}
          onLeftPathChange={setLeftPath}
          onRightPathChange={setRightPath}
          onSwapPaths={handleSwapPaths}
          isScanning={isComparing() || isExecuting()}
        />
      </div>

      {/* Sync Mode & Tools Toolbar */}
      <div class="flex-shrink-0">
        <SyncModeTabs
          syncVariant={syncVariant()}
          onSyncVariantChange={setSyncVariant}
          compareVariant={compareVariant()}
          onCompareVariantChange={setCompareVariant}
          onOpenFilter={() => setIsFilterOpen(true)}
          onOpenVersioning={() => setIsVersioningOpen(true)}
          onOpenProfiles={() => setIsProfilesOpen(true)}
          filterCount={filter().exclude_patterns.length}
        />
      </div>

      {/* Diff Table List */}
      <ComparisonDiffTable
        manifest={manifest()}
        onItemActionChange={handleItemActionChange}
      />

      {/* Modals */}
      <SyncProgressModal
        isOpen={isProgressOpen()}
        progress={syncProgress()}
        result={syncResult()}
        isExecuting={isExecuting()}
        onCancel={handleCancelSync}
        onClose={() => setIsProgressOpen(false)}
      />

      <FilterSettingsModal
        isOpen={isFilterOpen()}
        filter={filter()}
        onSave={setFilter}
        onClose={() => setIsFilterOpen(false)}
      />

      <VersioningSettingsModal
        isOpen={isVersioningOpen()}
        deletionVariant={deletionVariant()}
        versioningDir={versioningDir()}
        onSave={(variant, vDir) => {
          setDeletionVariant(variant);
          setVersioningDir(vDir);
        }}
        onClose={() => setIsVersioningOpen(false)}
      />

      <SavedProfilesModal
        isOpen={isProfilesOpen()}
        profiles={profiles()}
        onSelectProfile={handleSelectProfile}
        onSaveCurrentAsProfile={handleSaveCurrentAsProfile}
        onRefreshProfiles={loadProfiles}
        onClose={() => setIsProfilesOpen(false)}
      />
    </div>
  );
}
