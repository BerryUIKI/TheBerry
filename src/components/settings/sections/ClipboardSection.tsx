import { AppConfig } from "../../../types/config";
import { useI18n } from "../../../context/I18nContext";
import { useToast } from "../../../context/ToastContext";
import { setClipboardMonitorEnabled } from "../../../services/clipboard";
import { ClipboardList, AlertCircle } from "lucide-solid";

interface ClipboardSectionProps {
  config: () => AppConfig;
  handleSave: (updated: Partial<AppConfig>) => Promise<void>;
}

export function ClipboardSection(props: ClipboardSectionProps) {
  const { t, language } = useI18n();
  const { info, error } = useToast();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <ClipboardList size={16} class="text-primary" />
          <span>{t("settings.category_clipboard")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.clipboard_monitor_desc")}
        </p>
      </div>

      <div class="p-4 bg-card border border-border rounded-xl space-y-4 shadow-xs">
        {/* Monitoring Toggle */}
        <div class="flex items-center justify-between">
          <div class="space-y-0.5 pr-4">
            <span class="text-xs font-semibold text-foreground block">
              {t("settings.clipboard_monitor")}
            </span>
            <span class="text-[11px] text-muted-foreground block">
              Zero-overhead sequence counter polling on Windows
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              const nextVal = !props.config().clipboard_monitor_enabled;
              if (nextVal && !window.confirm(t("clipboard.enable_monitor_confirm"))) {
                return;
              }
              try {
                await setClipboardMonitorEnabled(nextVal);
                await props.handleSave({ clipboard_monitor_enabled: nextVal });
                info(
                  nextVal ? "Clipboard Monitor Enabled" : "Clipboard Monitor Disabled",
                  nextVal
                    ? (language() === "zh" ? "已恢复剪贴板自动监听" : "Clipboard monitoring resumed")
                    : (language() === "zh" ? "已暂停剪贴板自动监听" : "Clipboard monitoring paused")
                );
              } catch (err: any) {
                error("Failed to update monitor setting", err?.message || String(err));
              }
            }}
            class={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
              props.config().clipboard_monitor_enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <div
              class={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                props.config().clipboard_monitor_enabled ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Security Warning Notice */}
        <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-start space-x-2.5 text-xs leading-relaxed">
          <AlertCircle size={15} class="flex-shrink-0 mt-0.5 text-amber-500" />
          <span>{t("settings.clipboard_monitor_warning")}</span>
        </div>

        {/* History Limit Setting */}
        <div class="pt-2 border-t border-border flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-semibold text-foreground block">Max History Capacity</span>
            <span class="text-[11px] text-muted-foreground block">Number of latest clips to retain offline</span>
          </div>

          <span class="px-2.5 py-1 bg-secondary rounded-lg font-mono text-xs font-semibold text-foreground border border-border">
            {props.config().clipboard_history_limit || 200} clips
          </span>
        </div>
      </div>
    </div>
  );
}
