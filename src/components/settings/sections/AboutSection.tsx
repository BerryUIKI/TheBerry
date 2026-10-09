import { Show } from "solid-js";
import { DownloadProgress, UpdateInfo } from "../../../types/updater";
import { useI18n } from "../../../context/I18nContext";
import {
  Sparkles,
  RefreshCw,
  Download,
  AlertCircle,
  ExternalLink,
  Zap,
  Info,
} from "lucide-solid";

interface AboutSectionProps {
  currentVersion: () => string;
  checkingUpdate: () => boolean;
  updateInfo: () => UpdateInfo | null;
  updateError: () => string | null;
  isDownloading: () => boolean;
  downloadProgress: () => DownloadProgress | null;
  downloadedFilePath: () => string | null;
  isInstalling: () => boolean;
  handleCheckUpdate: () => Promise<void>;
  handleStartUpdate: () => Promise<void>;
  handleInstallAndRestart: () => Promise<void>;
}

export function AboutSection(props: AboutSectionProps) {
  const { t } = useI18n();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <Info size={16} class="text-primary" />
          <span>{t("settings.category_about")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.updater_desc")}
        </p>
      </div>

      {/* Version & Auto-Update Card */}
      <div class="p-4 bg-card border border-border rounded-xl space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold text-foreground flex items-center space-x-2">
            <Sparkles size={15} class="text-primary" />
            <span>{t("settings.version_card")}</span>
          </h3>
          <button
            type="button"
            disabled={props.checkingUpdate() || props.isDownloading()}
            onClick={props.handleCheckUpdate}
            class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors border border-border disabled:opacity-50"
          >
            <RefreshCw size={13} class={props.checkingUpdate() ? "animate-spin" : ""} />
            <span>{props.checkingUpdate() ? t("settings.downloading") : t("settings.check_update")}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            onClick={props.handleCheckUpdate}
            disabled={props.checkingUpdate()}
            title={t("settings.click_to_check")}
            class="p-3 bg-background border border-border hover:border-primary/50 hover:bg-muted/30 rounded-lg flex items-center justify-between cursor-pointer transition-all text-left w-full disabled:opacity-60 disabled:cursor-wait group"
          >
            <span class="text-muted-foreground group-hover:text-foreground transition-colors">{t("settings.installed_version")}</span>
            <span class="font-mono font-semibold text-foreground flex items-center space-x-1.5">
              <span>v{props.currentVersion()}</span>
              <Show when={props.checkingUpdate()}>
                <RefreshCw size={12} class="animate-spin text-primary" />
              </Show>
            </span>
          </button>

          <div class="p-3 bg-background border border-border rounded-lg flex items-center justify-between">
            <span class="text-muted-foreground">{t("settings.update_status")}</span>
            <Show
              when={props.updateInfo()}
              fallback={<span class="text-muted-foreground">{t("settings.silent_check")}</span>}
            >
              {props.updateInfo()?.has_update ? (
                <span class="font-semibold text-primary flex items-center space-x-1">
                  <span>{t("settings.new_release_ready", { version: props.updateInfo()?.latest_version || "" })}</span>
                </span>
              ) : (
                <span class="text-green-500 font-medium">{t("settings.up_to_date")}</span>
              )}
            </Show>
          </div>
        </div>

        {/* Update Error */}
        <Show when={props.updateError()}>
          <div class="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center space-x-2">
            <AlertCircle size={14} class="flex-shrink-0" />
            <span>{props.updateError()}</span>
          </div>
        </Show>

        {/* Update Action Panel */}
        <Show when={props.updateInfo()?.has_update}>
          <div class="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <div class="flex items-start justify-between">
              <div>
                <h4 class="text-xs font-bold text-foreground flex items-center space-x-1.5">
                  <Sparkles size={14} class="text-primary" />
                  <span>{t("settings.new_release_ready", { version: props.updateInfo()?.latest_version || "" })}</span>
                </h4>
                <Show when={props.updateInfo()?.asset_name}>
                  <p class="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Package: {props.updateInfo()?.asset_name}
                  </p>
                </Show>
              </div>

              <div class="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("open-update-modal", { detail: props.updateInfo() }));
                  }}
                  class="px-2.5 py-1 text-xs text-primary hover:text-primary/80 bg-primary/10 rounded-lg flex items-center space-x-1 transition-colors"
                >
                  <Sparkles size={11} />
                  <span>{t("updater.modal_title")}</span>
                </button>
                <a
                  href={props.updateInfo()?.release_url}
                  target="_blank"
                  rel="noreferrer"
                  class="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1"
                >
                  <span>{t("settings.changelog")}</span>
                  <ExternalLink size={11} />
                </a>
                <Show
                  when={props.downloadProgress()?.done || props.downloadedFilePath()}
                  fallback={
                    <button
                      type="button"
                      disabled={props.isDownloading()}
                      onClick={props.handleStartUpdate}
                      class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center space-x-1.5 transition-colors shadow-xs disabled:opacity-50"
                    >
                      <Download size={13} class={props.isDownloading() ? "animate-bounce" : ""} />
                      <span>{props.isDownloading() ? t("settings.downloading") : t("settings.update_now")}</span>
                    </button>
                  }
                >
                  <button
                    type="button"
                    disabled={props.isInstalling()}
                    onClick={props.handleInstallAndRestart}
                    class="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Zap size={13} class={props.isInstalling() ? "animate-spin" : ""} />
                    <span>{props.isInstalling() ? t("updater.installing") : t("updater.install_and_restart")}</span>
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* About Info Card */}
      <div class="p-4 bg-card border border-border rounded-xl space-y-2.5 text-xs shadow-xs">
        <h3 class="font-semibold text-foreground flex items-center space-x-2">
          <Info size={15} class="text-primary" />
          <span>About TheBerry</span>
        </h3>
        <p class="text-muted-foreground leading-relaxed">
          <strong>TheBerry</strong> is a high-performance desktop productivity suite built with <strong>Tauri v2 + Rust</strong> backend and <strong>SolidJS + Tailwind CSS</strong> frontend.
        </p>
        <div class="pt-2 flex items-center space-x-3 text-[11px] text-muted-foreground border-t border-border/60">
          <span>Release: v{props.currentVersion()}</span>
          <span>•</span>
          <a
            href="https://github.com/BerryUIKI/TheBerry"
            target="_blank"
            rel="noreferrer"
            class="hover:text-primary transition-colors inline-flex items-center space-x-1 underline-offset-2 hover:underline"
          >
            <span>GitHub Repository</span>
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
