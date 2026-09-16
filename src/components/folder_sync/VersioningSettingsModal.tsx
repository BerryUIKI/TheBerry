import { createSignal, Show } from "solid-js";
import { FolderOpen, Shield, Trash2, X, Archive, AlertTriangle } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { DeletionVariant } from "../../types/folder_sync";
import { useI18n } from "../../context/I18nContext";

interface VersioningSettingsModalProps {
  isOpen: boolean;
  deletionVariant: DeletionVariant;
  versioningDir: string;
  onSave: (variant: DeletionVariant, versioningDir: string) => void;
  onClose: () => void;
}

export function VersioningSettingsModal(props: VersioningSettingsModalProps) {
  const { language } = useI18n();
  const [selectedVariant, setSelectedVariant] = createSignal<DeletionVariant>(props.deletionVariant);
  const [vDir, setVDir] = createSignal(props.versioningDir);

  const handlePickVersionDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: language() === "zh" ? "选择版本控制归档存放文件夹" : "Select Versioning Archive Folder",
      });
      if (selected && typeof selected === "string") {
        setVDir(selected);
      }
    } catch (e) {
      console.error("Failed to pick versioning folder", e);
    }
  };

  const handleSave = () => {
    props.onSave(selectedVariant(), vDir());
    props.onClose();
  };

  if (!props.isOpen) return null;

  return (
    <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <Shield size={18} class="text-emerald-500" />
            <h3 class="text-sm font-semibold text-foreground">
              {language() === "zh" ? "删除保护与版本控制设置" : "Deletion Safety & Versioning Settings"}
            </h3>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Options */}
        <div class="flex flex-col gap-2.5">
          {/* Recycle Bin */}
          <label
            class={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedVariant() === "recycle_bin"
                ? "bg-primary/5 border-primary shadow-xs"
                : "bg-muted/20 border-border/70 hover:bg-muted/40"
            }`}
          >
            <input
              type="radio"
              name="deletion_variant"
              checked={selectedVariant() === "recycle_bin"}
              onChange={() => setSelectedVariant("recycle_bin")}
              class="mt-0.5 text-primary focus:ring-primary"
            />
            <div class="flex-1 text-xs">
              <div class="font-semibold text-foreground flex items-center gap-1.5">
                <Trash2 size={14} class="text-emerald-500" />
                <span>
                  {language() === "zh"
                    ? "放入系统回收站 (默认推荐)"
                    : "Send to Recycle Bin (Recommended)"}
                </span>
              </div>
              <p class="text-muted-foreground mt-0.5 leading-relaxed">
                {language() === "zh"
                  ? "被覆盖或同步删除的文件将安全移入操作系统回收站，随时可撤销恢复。"
                  : "Files overwritten or deleted during sync will be moved to the Recycle Bin and can be restored anytime."}
              </p>
            </div>
          </label>

          {/* Versioning */}
          <label
            class={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedVariant() === "versioning"
                ? "bg-primary/5 border-primary shadow-xs"
                : "bg-muted/20 border-border/70 hover:bg-muted/40"
            }`}
          >
            <input
              type="radio"
              name="deletion_variant"
              checked={selectedVariant() === "versioning"}
              onChange={() => setSelectedVariant("versioning")}
              class="mt-0.5 text-primary focus:ring-primary"
            />
            <div class="flex-1 text-xs">
              <div class="font-semibold text-foreground flex items-center gap-1.5">
                <Archive size={14} class="text-blue-500" />
                <span>
                  {language() === "zh"
                    ? "版本控制归档文件夹 (FreeFileSync 原生特性)"
                    : "Versioning Archive Folder (FreeFileSync Native)"}
                </span>
              </div>
              <p class="text-muted-foreground mt-0.5 leading-relaxed">
                {language() === "zh"
                  ? "每次同步被替换或删除的文件将自动保存在指定归档目录中，按日期时间戳命名，形成完整历史版本。"
                  : "Files replaced or removed during sync will be archived in the target directory with timestamps, preserving complete history."}
              </p>
            </div>
          </label>

          {/* Versioning Dir Input */}
          <Show when={selectedVariant() === "versioning"}>
            <div class="ml-6 p-3 bg-secondary/40 border border-border/80 rounded-lg flex flex-col gap-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <span class="font-medium text-foreground">
                {language() === "zh" ? "归档存放目标文件夹:" : "Archive Destination Folder:"}
              </span>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  value={vDir()}
                  onInput={(e) => setVDir(e.currentTarget.value)}
                  placeholder={language() === "zh" ? "例如: D:\\Backup\\Versioning" : "e.g. D:\\Backup\\Versioning"}
                  class="flex-1 bg-background border border-input rounded-md px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handlePickVersionDir}
                  class="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-xs font-medium transition-colors"
                >
                  <FolderOpen size={13} />
                  <span>{language() === "zh" ? "选择" : "Browse"}</span>
                </button>
              </div>
            </div>
          </Show>

          {/* Permanent Delete */}
          <label
            class={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedVariant() === "permanent"
                ? "bg-rose-500/5 border-rose-500/80 shadow-xs"
                : "bg-muted/20 border-border/70 hover:bg-muted/40"
            }`}
          >
            <input
              type="radio"
              name="deletion_variant"
              checked={selectedVariant() === "permanent"}
              onChange={() => setSelectedVariant("permanent")}
              class="mt-0.5 text-rose-500 focus:ring-rose-500"
            />
            <div class="flex-1 text-xs">
              <div class="font-semibold text-rose-500 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>
                  {language() === "zh" ? "永久删除 (高风险)" : "Permanent Deletion (High Risk)"}
                </span>
              </div>
              <p class="text-muted-foreground mt-0.5 leading-relaxed">
                {language() === "zh"
                  ? "被删除的文件将直接从磁盘扇区物理抹除，无法从回收站恢复，适合空间极其有限的场景。"
                  : "Files will be erased permanently without moving to the Recycle Bin. Suitable for low disk space."}
              </p>
            </div>
          </label>
        </div>

        {/* Buttons */}
        <div class="flex items-center justify-end gap-2 border-t border-border pt-3 mt-1">
          <button
            onClick={props.onClose}
            class="px-4 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors"
          >
            {language() === "zh" ? "取消" : "Cancel"}
          </button>
          <button
            onClick={handleSave}
            class="px-5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-colors"
          >
            {language() === "zh" ? "确认保存" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
