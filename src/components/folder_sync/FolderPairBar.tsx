import { ArrowLeftRight, Folder, FolderOpen, RefreshCw } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";

interface FolderPairBarProps {
  leftPath: string;
  rightPath: string;
  onLeftPathChange: (path: string) => void;
  onRightPathChange: (path: string) => void;
  onSwapPaths: () => void;
  isScanning: boolean;
}

export function FolderPairBar(props: FolderPairBarProps) {
  const { t } = useI18n();

  const handlePickFolder = async (side: "left" | "right") => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: side === "left" ? t("folder_sync.select_left") : t("folder_sync.select_right"),
      });

      if (selected && typeof selected === "string") {
        if (side === "left") {
          props.onLeftPathChange(selected);
        } else {
          props.onRightPathChange(selected);
        }
      }
    } catch (err) {
      console.error("Failed to pick folder", err);
    }
  };

  return (
    <div class="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
      {/* Left (Source) Folder */}
      <div class="flex-1 w-full">
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            {t("folder_sync.left_folder")} (源目录)
          </label>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              value={props.leftPath}
              onInput={(e) => props.onLeftPathChange(e.currentTarget.value)}
              placeholder={t("folder_sync.left_placeholder")}
              class="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono truncate"
            />
          </div>
          <button
            onClick={() => handlePickFolder("left")}
            disabled={props.isScanning}
            class="flex items-center gap-1 px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors flex-shrink-0 disabled:opacity-50"
            title={t("folder_sync.browse")}
          >
            <FolderOpen size={14} />
            <span>{t("folder_sync.browse")}</span>
          </button>
        </div>
      </div>

      {/* Swap Button */}
      <div class="flex items-center justify-center pt-5">
        <button
          onClick={props.onSwapPaths}
          disabled={props.isScanning}
          class="p-2.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all shadow-sm hover:rotate-180 disabled:opacity-50"
          title={t("folder_sync.swap_paths")}
        >
          <ArrowLeftRight size={16} />
        </button>
      </div>

      {/* Right (Target) Folder */}
      <div class="flex-1 w-full">
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            {t("folder_sync.right_folder")} (目标目录)
          </label>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              value={props.rightPath}
              onInput={(e) => props.onRightPathChange(e.currentTarget.value)}
              placeholder={t("folder_sync.right_placeholder")}
              class="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono truncate"
            />
          </div>
          <button
            onClick={() => handlePickFolder("right")}
            disabled={props.isScanning}
            class="flex items-center gap-1 px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors flex-shrink-0 disabled:opacity-50"
            title={t("folder_sync.browse")}
          >
            <FolderOpen size={14} />
            <span>{t("folder_sync.browse")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
