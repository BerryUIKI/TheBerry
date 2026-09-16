import { createSignal, onMount, onCleanup, Show } from "solid-js";
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  RefreshCw,
  Zap,
  Gauge,
  HardDrive,
  ShieldCheck,
} from "lucide-solid";
import { UpdateInfo, DownloadProgress } from "../../types/updater";
import {
  downloadUpdate,
  installAndRestart,
  onDownloadProgress,
  formatBytes,
  formatSpeed,
} from "../../services/updater";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { MarkdownContent } from "../common/MarkdownContent";

export function UpdateModal(props: {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
}) {
  const { t } = useI18n();
  const { error, success } = useToast();

  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = createSignal<string | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = createSignal<string | null>(null);
  const [isInstalling, setIsInstalling] = createSignal(false);
  const [silentInstall, setSilentInstall] = createSignal(true);

  onMount(() => {
    let unlisten: (() => void) | null = null;
    onDownloadProgress((prog) => {
      setDownloadProgress(prog);
      if (prog.done) {
        setIsDownloading(false);
        if (prog.file_path) {
          setDownloadedFilePath(prog.file_path);
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    onCleanup(() => {
      if (unlisten) unlisten();
    });
  });

  const handleStartDownload = async () => {
    const info = props.updateInfo;
    if (!info?.download_url) return;

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({
      bytes_downloaded: 0,
      percent: 0,
      speed_bytes_per_sec: 0,
      done: false,
      status: "Starting...",
    });

    try {
      const path = await downloadUpdate(info.download_url);
      setDownloadedFilePath(path);
      success("Update Downloaded", "Update installer is cached and ready to install.");
    } catch (err: any) {
      const msg = err?.message || String(err);
      setDownloadError(msg);
      error("Download Failed", msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleInstallAndRestart = async () => {
    setIsInstalling(true);
    try {
      await installAndRestart(downloadedFilePath() || undefined, silentInstall());
    } catch (err: any) {
      const msg = err?.message || String(err);
      setDownloadError(msg);
      error("Install Failed", msg);
      setIsInstalling(false);
    }
  };

  const isCompleted = () => downloadProgress()?.done || !!downloadedFilePath();

  return (
    <Show when={props.isOpen && props.updateInfo}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md animate-in fade-in duration-150 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isDownloading() && !isInstalling()) {
            props.onClose();
          }
        }}
      >
        <div class="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40 flex-shrink-0">
            <div class="flex items-center space-x-2.5">
              <div class="p-2 rounded-xl bg-primary/10 text-primary">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 class="text-sm font-bold text-foreground">
                  {t("updater.modal_title")}
                </h3>
                <p class="text-xs text-muted-foreground">
                  {t("updater.new_version_title", { version: props.updateInfo?.latest_version || "" })}
                </p>
              </div>
            </div>

            <button
              onClick={props.onClose}
              disabled={isDownloading() || isInstalling()}
              class="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95 disabled:opacity-40"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body Content */}
          <div class="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Version Transition Card */}
            <div class="p-3.5 bg-secondary/40 border border-border rounded-xl flex items-center justify-between text-xs">
              <div class="flex items-center space-x-3">
                <div class="flex flex-col">
                  <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {t("updater.current_version")}
                  </span>
                  <span class="font-mono font-semibold text-foreground text-sm">
                    v{props.updateInfo?.current_version}
                  </span>
                </div>

                <div class="text-primary font-bold text-base">→</div>

                <div class="flex flex-col">
                  <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {t("updater.latest_version")}
                  </span>
                  <span class="font-mono font-bold text-primary text-sm flex items-center space-x-1">
                    <span>{props.updateInfo?.latest_version}</span>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-primary/20 text-primary uppercase font-sans font-semibold">
                      New
                    </span>
                  </span>
                </div>
              </div>

              <Show when={props.updateInfo?.published_at}>
                <div class="text-right text-[11px] text-muted-foreground">
                  <div>{t("updater.published_at")}</div>
                  <div class="font-mono">
                    {new Date(props.updateInfo?.published_at!).toLocaleDateString()}
                  </div>
                </div>
              </Show>
            </div>

            {/* Release Notes */}
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                <span>{t("updater.release_notes")}</span>
              </label>
              <div class="p-3.5 bg-background border border-border rounded-xl max-h-48 overflow-y-auto text-xs leading-relaxed text-foreground select-text">
                <Show
                  when={props.updateInfo?.release_notes?.trim()}
                  fallback={
                    <span class="text-muted-foreground italic">
                      {t("updater.no_notes")}
                    </span>
                  }
                >
                  <MarkdownContent content={props.updateInfo?.release_notes || ""} />
                </Show>
              </div>
            </div>

            {/* Error message */}
            <Show when={downloadError()}>
              <div class="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle size={15} class="flex-shrink-0" />
                <span class="flex-1 select-text">{downloadError()}</span>
              </div>
            </Show>

            {/* Download Progress & Metrics Area */}
            <Show when={isDownloading() || downloadProgress()}>
              <div class="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                <div class="flex items-center justify-between text-xs font-medium">
                  <span class="text-foreground flex items-center space-x-1.5">
                    <Show
                      when={isCompleted()}
                      fallback={<RefreshCw size={13} class="animate-spin text-primary" />}
                    >
                      <CheckCircle2 size={14} class="text-green-500" />
                    </Show>
                    <span>
                      {isCompleted()
                        ? t("updater.download_completed")
                        : t("updater.downloading")}
                    </span>
                  </span>
                  <span class="font-mono font-bold text-primary">
                    {Math.round(downloadProgress()?.percent || 0)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div class="w-full bg-muted rounded-full h-2.5 overflow-hidden shadow-inner">
                  <div
                    class="bg-primary h-full transition-all duration-200 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, downloadProgress()?.percent || 0))}%` }}
                  />
                </div>

                {/* Metric stats line */}
                <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-muted-foreground">
                  <div class="flex items-center space-x-1.5">
                    <HardDrive size={12} class="text-primary flex-shrink-0" />
                    <span>
                      {formatBytes(downloadProgress()?.bytes_downloaded || 0)}
                      {downloadProgress()?.total_bytes
                        ? ` / ${formatBytes(downloadProgress()?.total_bytes!)}`
                        : ""}
                    </span>
                  </div>

                  <div class="flex items-center justify-end space-x-1.5">
                    <Gauge size={12} class="text-primary flex-shrink-0" />
                    <span>
                      {isCompleted()
                        ? "Done"
                        : formatSpeed(downloadProgress()?.speed_bytes_per_sec || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </Show>

            {/* In-place installation & Silent Toggle (when download is completed) */}
            <Show when={isCompleted()}>
              <div class="p-4 bg-secondary/40 border border-border rounded-xl space-y-3">
                <div class="flex items-start space-x-2 text-xs text-muted-foreground">
                  <ShieldCheck size={16} class="text-green-500 flex-shrink-0 mt-0.5" />
                  <p class="leading-relaxed">
                    {t("updater.install_tip")}
                  </p>
                </div>

                {/* Silent Install Checkbox */}
                <label class="flex items-start space-x-2.5 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={silentInstall()}
                    onChange={(e) => setSilentInstall(e.currentTarget.checked)}
                    class="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <div class="text-xs">
                    <div class="font-medium text-foreground">
                      {t("updater.silent_install")}
                    </div>
                    <div class="text-[11px] text-muted-foreground">
                      {t("updater.silent_install_desc")}
                    </div>
                  </div>
                </label>
              </div>
            </Show>
          </div>

          {/* Footer Actions */}
          <div class="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between flex-shrink-0">
            <Show
              when={props.updateInfo?.release_url}
              fallback={<div />}
            >
              <a
                href={props.updateInfo?.release_url}
                target="_blank"
                rel="noreferrer"
                class="text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1.5 transition-colors"
              >
                <span>{t("updater.view_github")}</span>
                <ExternalLink size={12} />
              </a>
            </Show>

            <div class="flex items-center space-x-2.5">
              <button
                disabled={isDownloading() || isInstalling()}
                onClick={props.onClose}
                class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
              >
                {t("updater.close")}
              </button>

              <Show
                when={isCompleted()}
                fallback={
                  <button
                    disabled={isDownloading() || !props.updateInfo?.download_url}
                    onClick={handleStartDownload}
                    class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <Download size={14} class={isDownloading() ? "animate-bounce" : ""} />
                    <span>
                      {isDownloading()
                        ? t("settings.downloading")
                        : t("updater.start_download")}
                    </span>
                  </button>
                }
              >
                <button
                  disabled={isInstalling()}
                  onClick={handleInstallAndRestart}
                  class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Zap size={14} class={isInstalling() ? "animate-spin" : ""} />
                  <span>
                    {isInstalling()
                      ? t("updater.installing")
                      : t("updater.install_and_restart")}
                  </span>
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
