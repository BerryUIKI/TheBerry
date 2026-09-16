import { For } from "solid-js";
import {
  ArrowLeftRight,
  Copy,
  FolderGit2,
  GitCompare,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Bookmark,
  Clock,
  Hash,
} from "lucide-solid";
import { CompareVariant, SyncVariant } from "../../types/folder_sync";
import { useI18n } from "../../context/I18nContext";

interface SyncModeTabsProps {
  syncVariant: SyncVariant;
  onSyncVariantChange: (variant: SyncVariant) => void;
  compareVariant: CompareVariant;
  onCompareVariantChange: (variant: CompareVariant) => void;
  onOpenFilter: () => void;
  onOpenVersioning: () => void;
  onOpenProfiles: () => void;
  filterCount: number;
}

const syncVariantsList: Array<{
  id: SyncVariant;
  labelKey: string;
  descKey: string;
  icon: typeof ArrowLeftRight;
}> = [
  {
    id: "two_way",
    labelKey: "folder_sync.mode_two_way",
    descKey: "folder_sync.mode_two_way_desc",
    icon: ArrowLeftRight,
  },
  {
    id: "mirror",
    labelKey: "folder_sync.mode_mirror",
    descKey: "folder_sync.mode_mirror_desc",
    icon: Copy,
  },
  {
    id: "update",
    labelKey: "folder_sync.mode_update",
    descKey: "folder_sync.mode_update_desc",
    icon: Layers,
  },
  {
    id: "custom",
    labelKey: "folder_sync.mode_custom",
    descKey: "folder_sync.mode_custom_desc",
    icon: SlidersHorizontal,
  },
];

export function SyncModeTabs(props: SyncModeTabsProps) {
  const { t, language } = useI18n();

  return (
    <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-sm">
      {/* Mode Selector */}
      <div class="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50 overflow-x-auto">
        <For each={syncVariantsList}>
          {(variant) => {
            const isActive = () => props.syncVariant === variant.id;
            const Icon = variant.icon;
            return (
              <button
                onClick={() => props.onSyncVariantChange(variant.id)}
                class={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  isActive()
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
                title={t(variant.descKey as any)}
              >
                <Icon size={14} class={isActive() ? "text-primary" : "text-muted-foreground"} />
                <span>{t(variant.labelKey as any)}</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Auxiliary Settings Bar */}
      <div class="flex items-center gap-2 flex-wrap justify-end">
        {/* Compare Variant Toggle */}
        <div class="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50 text-xs">
          <button
            onClick={() => props.onCompareVariantChange("time_and_size")}
            class={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              props.compareVariant === "time_and_size"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={
              language() === "zh"
                ? "基于文件修改时间与字节大小快速比对"
                : "Fast comparison by modification time and byte size"
            }
          >
            <Clock size={12} />
            <span>{language() === "zh" ? "时间与大小" : "Time & Size"}</span>
          </button>
          <button
            onClick={() => props.onCompareVariantChange("content_hash")}
            class={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              props.compareVariant === "content_hash"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={
              language() === "zh"
                ? "计算 SHA-256 流式哈希进行字节级无死角比对"
                : "Bit-by-bit comparison using SHA-256 streaming hash"
            }
          >
            <Hash size={12} />
            <span>{language() === "zh" ? "内容哈希" : "Content Hash"}</span>
          </button>
        </div>

        {/* Filter Modal Trigger */}
        <button
          onClick={props.onOpenFilter}
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors"
          title={language() === "zh" ? "设置包含/排除过滤规则" : "Configure include and exclude filter rules"}
        >
          <SlidersHorizontal size={13} />
          <span>{language() === "zh" ? "过滤器" : "Filters"}</span>
          {props.filterCount > 0 && (
            <span class="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
              {props.filterCount}
            </span>
          )}
        </button>

        {/* Deletion & Versioning Modal Trigger */}
        <button
          onClick={props.onOpenVersioning}
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors"
          title={
            language() === "zh"
              ? "配置删除保护与版本控制归档目录"
              : "Configure deletion safety and versioning directory"
          }
        >
          <ShieldCheck size={14} class="text-emerald-500" />
          <span>{language() === "zh" ? "版本控制与安全" : "Versioning & Safety"}</span>
        </button>

        {/* Saved Profiles */}
        <button
          onClick={props.onOpenProfiles}
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors"
          title={language() === "zh" ? "保存或加载常用同步任务方案" : "Save or load sync task profiles"}
        >
          <Bookmark size={13} />
          <span>{language() === "zh" ? "任务方案" : "Profiles"}</span>
        </button>
      </div>
    </div>
  );
}
