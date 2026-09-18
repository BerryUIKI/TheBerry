import { Show } from "solid-js";
import { useI18n } from "../../../context/I18nContext";
import { revealInExplorer } from "../../../services/fileSearch";
import { HardDrive, FolderDot, Copy, Upload, FileArchive, Check } from "lucide-solid";

interface StorageSectionProps {
  dataDir: () => string | null;
  handleExportBackup: () => Promise<void>;
  handleImportBackup: () => Promise<void>;
  showImportModal: () => boolean;
  setShowImportModal: (show: boolean) => void;
  importJsonText: () => string;
  setImportJsonText: (val: string) => void;
  isExporting: () => boolean;
}

export function StorageSection(props: StorageSectionProps) {
  const { t } = useI18n();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <HardDrive size={16} class="text-primary" />
          <span>{t("settings.storage_title")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.storage_desc")}
        </p>
      </div>

      {/* Directory Box */}
      <div class="p-4 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <label class="text-xs font-semibold text-foreground">{t("settings.storage_dir_label")}</label>
        <div class="flex items-center space-x-2">
          <div class="flex-1 p-2.5 bg-background border border-input rounded-lg font-mono text-xs text-foreground flex items-center space-x-2 overflow-hidden">
            <FolderDot size={14} class="text-primary flex-shrink-0" />
            <span class="truncate">{props.dataDir() || "Not configured yet"}</span>
          </div>
          <button
            type="button"
            disabled={!props.dataDir()}
            onClick={async () => {
              const dir = props.dataDir();
              if (dir) {
                try {
                  await revealInExplorer(dir);
                } catch (e) {
                  console.warn("Reveal error:", e);
                }
              }
            }}
            class="px-3.5 py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs flex items-center space-x-1.5 font-medium transition-colors disabled:opacity-50 border border-border flex-shrink-0"
          >
            <span>{t("settings.open_explorer")}</span>
          </button>
        </div>

        {/* Backup & Restore Action Bar */}
        <div class="pt-3 border-t border-border flex items-center justify-between">
          <div>
            <span class="font-semibold text-foreground text-xs block">{t("settings.backup_title")}</span>
            <span class="text-[11px] text-muted-foreground">{t("settings.backup_subtitle")}</span>
          </div>
          <div class="flex items-center space-x-2">
            <button
              type="button"
              disabled={props.isExporting()}
              onClick={props.handleExportBackup}
              class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium flex items-center space-x-1.5 border border-border transition-colors disabled:opacity-50"
            >
              <Copy size={13} class="text-primary" />
              <span>{props.isExporting() ? "Exporting..." : t("settings.export_btn")}</span>
            </button>
            <button
              type="button"
              onClick={() => props.setShowImportModal(true)}
              class="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <Upload size={13} />
              <span>{t("settings.restore_btn")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Import Backup Modal */}
      <Show when={props.showImportModal()}>
        <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div class="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <FileArchive size={16} class="text-primary" />
                <h3 class="font-bold text-sm text-foreground">{t("settings.restore_modal_title")}</h3>
              </div>
              <button
                type="button"
                onClick={() => props.setShowImportModal(false)}
                class="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-muted-foreground">
              {t("settings.restore_modal_desc")}
            </p>

            <textarea
              rows={8}
              value={props.importJsonText()}
              onInput={(e) => props.setImportJsonText(e.currentTarget.value)}
              placeholder='Paste full backup JSON {"version": "0.1.0", ...} here...'
              class="w-full p-2.5 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />

            <div class="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => props.setShowImportModal(false)}
                class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={props.handleImportBackup}
                class="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <Check size={14} />
                <span>{t("settings.confirm_restore")}</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
