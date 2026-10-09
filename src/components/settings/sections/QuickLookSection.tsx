import { Show } from "solid-js";
import { AppConfig } from "../../../types/config";
import { QuickLookStatus } from "../../../types/quicklook";
import { useI18n } from "../../../context/I18nContext";
import { Eye, Power, ExternalLink } from "lucide-solid";

interface QuickLookSectionProps {
  config: () => AppConfig;
  qlStatus: () => QuickLookStatus | null;
  isStartingQl: () => boolean;
  handleToggleQuickLook: (checked: boolean) => Promise<void>;
  handleStartQuickLook: () => Promise<void>;
  handleStopQuickLook: () => Promise<void>;
  handleTestPreview: () => Promise<void>;
}

export function QuickLookSection(props: QuickLookSectionProps) {
  const { t } = useI18n();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <Eye size={16} class="text-primary" />
          <span>{t("settings.quicklook")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.quicklook_desc")}
        </p>
      </div>

      <div class="p-4 bg-card border border-border rounded-xl space-y-3.5 shadow-xs">
        {/* Status Indicator & Header */}
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground">Engine Daemon Status</span>
          <div class="flex items-center space-x-2">
            <Show
              when={props.config().quicklook_enabled !== false}
              fallback={
                <span class="text-[10px] px-2 py-0.5 rounded font-mono bg-destructive/10 text-destructive border border-destructive/20">
                  {t("settings.quicklook_disabled")}
                </span>
              }
            >
              <Show
                when={props.qlStatus()?.is_running}
                fallback={
                  <span class="text-[10px] px-2 py-0.5 rounded font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {t("settings.quicklook_stopped")} ({t("settings.quicklook_builtin_active")})
                  </span>
                }
              >
                <span class="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center space-x-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <span>{t("settings.quicklook_running")}</span>
                </span>
              </Show>
            </Show>
          </div>
        </div>

        {/* Master Enable/Disable Toggle */}
        <div class="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
          <div class="space-y-0.5 pr-4">
            <span class="text-xs font-semibold text-foreground block">
              {t("settings.enable_quicklook")}
            </span>
            <span class="text-[11px] text-muted-foreground block">
              {t("settings.enable_quicklook_desc")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => props.handleToggleQuickLook(props.config().quicklook_enabled === false)}
            class={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
              props.config().quicklook_enabled !== false ? "bg-primary" : "bg-muted"
            }`}
          >
            <div
              class={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                props.config().quicklook_enabled !== false ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Quick Actions Bar */}
        <Show when={props.config().quicklook_enabled !== false}>
          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center space-x-2">
              <Show
                when={props.qlStatus()?.is_running}
                fallback={
                  <button
                    type="button"
                    disabled={props.isStartingQl()}
                    onClick={props.handleStartQuickLook}
                    class="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <Power size={13} />
                    <span>{props.isStartingQl() ? "..." : t("settings.quicklook_start_btn")}</span>
                  </button>
                }
              >
                <button
                  type="button"
                  disabled={props.isStartingQl()}
                  onClick={props.handleStopQuickLook}
                  class="px-2.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Power size={13} />
                  <span>{props.isStartingQl() ? "..." : t("settings.quicklook_stop_btn")}</span>
                </button>
              </Show>

              <button
                type="button"
                onClick={props.handleTestPreview}
                class="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <Eye size={13} class="text-primary" />
                <span>{t("settings.quicklook_test_btn")}</span>
              </button>
            </div>

            <Show when={props.qlStatus()?.is_embedded}>
              <span class="text-[10px] text-muted-foreground font-mono">
                {t("settings.quicklook_embedded_badge")}
              </span>
            </Show>
          </div>
        </Show>

        {/* Capabilities Highlight Chips */}
        <div class="pt-2 border-t border-border space-y-2">
          <span class="text-[11px] font-semibold text-muted-foreground block">Key Feature Enhancements:</span>
          <div class="flex flex-wrap gap-1.5">
            <span class="text-[10px] px-2 py-0.5 rounded bg-secondary/80 text-foreground/80 border border-border">
              🎥 Video Click-to-Pause & Seek (Space, ←/→, ↑/↓, M, F)
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-secondary/80 text-foreground/80 border border-border">
              🖼️ SVG Dark & Checkerboard Theme
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-secondary/80 text-foreground/80 border border-border">
              🚀 Open With & Auto-Dismiss
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-secondary/80 text-foreground/80 border border-border">
              📄 Markdown / Code / PDF / CSV
            </span>
          </div>
        </div>

        {/* Upstream links */}
        <div class="pt-2 flex items-center space-x-4 text-xs">
          <a
            href="https://github.com/BerryUIKI/QuickLook"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center space-x-1 text-primary hover:underline font-medium"
          >
            <span>{t("settings.quicklook_upstream_fork")}</span>
            <ExternalLink size={11} />
          </a>
          <a
            href="https://github.com/QL-Win/QuickLook"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center space-x-1 text-muted-foreground hover:text-foreground hover:underline"
          >
            <span>Upstream QL-Win/QuickLook</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
