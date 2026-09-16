import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { AppConfig } from "../types/config";
import { getConfig, updateConfig } from "../services/system";
import { revealInExplorer } from "../services/fileSearch";
import {
  checkForUpdates,
  downloadUpdate,
  installAndRestart,
  downloadAndInstallUpdate,
  getAppVersion,
  onDownloadProgress,
  formatBytes,
  formatSpeed,
} from "../services/updater";
import { isAutostartEnabled, setAutostart } from "../services/autostart";
import { exportFullBackup, importFullBackup } from "../services/backup";
import { copyToSystemClipboard, setClipboardMonitorEnabled } from "../services/clipboard";
import { getQuickLookStatus } from "../services/quicklook";
import { setGlobalShortcutsEnabled, setHudShortcut } from "../services/shortcuts";
import { HotkeyRecorder } from "../components/settings/HotkeyRecorder";
import { GooseConfigModal } from "../components/goose/GooseConfigModal";
import { getAIConfig, saveAIConfig } from "../services/goose";
import { QuickLookStatus } from "../types/quicklook";
import { AIConfig } from "../types/goose";
import { DownloadProgress, UpdateInfo } from "../types/updater";
import { useApp } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";
import {
  Settings,
  FolderDot,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Eye,
  Info,
  Sparkles,
  RefreshCw,
  Download,
  AlertCircle,
  ExternalLink,
  Power,
  FileArchive,
  Upload,
  Copy,
  Check,
  Languages,
  Keyboard,
  ClipboardList,
  Zap,
  Gauge,
} from "lucide-solid";

export function SettingsView() {
  const { success, error, info } = useToast();
  const { dataDir } = useApp();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage, assistantName } = useI18n();
  const [config, setConfigState] = createSignal<AppConfig>({
    version: "0.1.11",
    theme: "dark",
    language: "en",
    close_to_tray: true,
    autostart: false,
    clipboard_history_limit: 200,
    clipboard_monitor_enabled: true,
    custom_data_dir: "",
  });
  const [autostartActive, setAutostartActive] = createSignal(false);
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [importJsonText, setImportJsonText] = createSignal("");
  const [isExporting, setIsExporting] = createSignal(false);
  const [savedMessage, setSavedMessage] = createSignal<string | null>(null);

  // Updater State
  const [currentVersion, setCurrentVersion] = createSignal("0.1.11");
  const [checkingUpdate, setCheckingUpdate] = createSignal(false);
  const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = createSignal<string | null>(null);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = createSignal<string | null>(null);
  const [isInstalling, setIsInstalling] = createSignal(false);
  const [silentInstall, setSilentInstall] = createSignal(true);
  const [qlStatus, setQlStatus] = createSignal<QuickLookStatus | null>(null);
  const [aiConfig, setAiConfig] = createSignal<AIConfig | null>(null);
  const [showAiModal, setShowAiModal] = createSignal(false);

  const reloadSettings = async () => {
    try {
      const cfg = await getConfig();
      setConfigState(cfg);
      const ver = await getAppVersion();
      if (ver) setCurrentVersion(ver);
      const autoStatus = await isAutostartEnabled();
      setAutostartActive(autoStatus);
      const ql = await getQuickLookStatus();
      setQlStatus(ql);
      const ai = await getAIConfig();
      setAiConfig(ai);
    } catch (e) {
      console.warn("Failed to load settings or version:", e);
    }
  };

  onMount(async () => {
    await reloadSettings();

    let unlistenFn: (() => void) | null = null;
    onDownloadProgress((prog) => {
      setDownloadProgress(prog);
      if (prog.done) {
        setIsDownloading(false);
        if (prog.file_path) {
          setDownloadedFilePath(prog.file_path);
        }
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    onCleanup(() => {
      if (unlistenFn) unlistenFn();
    });
  });

  const handleToggleAutostart = async (checked: boolean) => {
    try {
      const result = await setAutostart(checked);
      setAutostartActive(result);
      await handleSave({ autostart: result });
      if (result) {
        success("Autostart Enabled", "TheBerry will automatically launch on system boot");
      } else {
        info("Autostart Disabled", "Removed from system startup");
      }
    } catch (err: any) {
      error("Autostart Failed", err.message || String(err));
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const json = await exportFullBackup();
      await copyToSystemClipboard(json);
      success("Backup JSON Copied", "Full backup data (Clipboard, Snippets, Launcher, Config) copied to clipboard!");
    } catch (err: any) {
      error("Export Failed", err.message || String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    if (!importJsonText().trim()) {
      error("Empty JSON", "Please paste backup JSON content");
      return;
    }
    try {
      const summary = await importFullBackup(importJsonText());
      setShowImportModal(false);
      setImportJsonText("");
      success("Backup Restored", `Restored ${summary.clipboard_count} clips, ${summary.snippets_count} snippets, and ${summary.launcher_count} launcher items.`);
    } catch (err: any) {
      error("Restore Failed", err.message || String(err));
    }
  };

  const handleSave = async (updated: Partial<AppConfig>) => {
    const current = { ...config(), ...updated };
    setConfigState(current);
    try {
      await updateConfig(current);
      setSavedMessage("Settings saved successfully");
      success("Settings Saved");
      setTimeout(() => setSavedMessage(null), 2000);
    } catch (e) {
      error("Failed to save settings", String(e));
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    try {
      const releaseInfo = await checkForUpdates();
      setUpdateInfo(releaseInfo);
      if (releaseInfo.has_update) {
        success("Update Available", `Version ${releaseInfo.latest_version} is ready to install!`);
      } else {
        info("Up to Date", `TheBerry v${releaseInfo.current_version} is the latest version.`);
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      setUpdateError(msg);
      error("Update Check Failed", msg);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleStartUpdate = async () => {
    const info = updateInfo();
    if (!info?.download_url) return;

    setIsDownloading(true);
    setUpdateError(null);
    try {
      const path = await downloadUpdate(info.download_url);
      setDownloadedFilePath(path);
      success("Download Completed", "Update package is ready to install.");
    } catch (err: any) {
      const msg = err?.message || String(err);
      setUpdateError(msg);
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
      setUpdateError(msg);
      error("Install Failed", msg);
      setIsInstalling(false);
    }
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-5 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
          <Settings class="text-primary" size={20} />
          <span>{t("settings.title")}</span>
        </h1>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Save alert */}
      <Show when={savedMessage()}>
        <div class="flex items-center space-x-2 p-2.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-md text-xs">
          <CheckCircle2 size={14} />
          <span>{savedMessage()}</span>
        </div>
      </Show>

      {/* Version & Auto-Update Card */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
            <Sparkles size={15} class="text-primary" />
            <span>{t("settings.version_card")}</span>
          </h2>
          <button
            disabled={checkingUpdate() || isDownloading()}
            onClick={handleCheckUpdate}
            class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors border border-border disabled:opacity-50"
          >
            <RefreshCw size={13} class={checkingUpdate() ? "animate-spin" : ""} />
            <span>{checkingUpdate() ? t("settings.downloading") : t("settings.check_update")}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="p-3 bg-background border border-border rounded flex items-center justify-between">
            <span class="text-muted-foreground">{t("settings.installed_version")}</span>
            <span class="font-mono font-semibold text-foreground">v{currentVersion()}</span>
          </div>

          <div class="p-3 bg-background border border-border rounded flex items-center justify-between">
            <span class="text-muted-foreground">{t("settings.update_status")}</span>
            <Show
              when={updateInfo()}
              fallback={<span class="text-muted-foreground">{t("settings.silent_check")}</span>}
            >
              {updateInfo()?.has_update ? (
                <span class="font-semibold text-primary flex items-center space-x-1">
                  <span>{t("settings.new_release_ready", { version: updateInfo()?.latest_version || "" })}</span>
                </span>
              ) : (
                <span class="text-green-500 font-medium">{t("settings.up_to_date")}</span>
              )}
            </Show>
          </div>
        </div>

        {/* Update Error */}
        <Show when={updateError()}>
          <div class="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded text-xs flex items-center space-x-2">
            <AlertCircle size={14} class="flex-shrink-0" />
            <span>{updateError()}</span>
          </div>
        </Show>

        {/* Update Action Panel */}
        <Show when={updateInfo()?.has_update}>
          <div class="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-xs font-bold text-foreground flex items-center space-x-1.5">
                  <Sparkles size={14} class="text-primary" />
                  <span>{t("settings.new_release_ready", { version: updateInfo()?.latest_version || "" })}</span>
                </h3>
                <Show when={updateInfo()?.asset_name}>
                  <p class="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Package: {updateInfo()?.asset_name}
                  </p>
                </Show>
              </div>

              <div class="flex items-center space-x-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("open-update-modal", { detail: updateInfo() }));
                  }}
                  class="px-2.5 py-1 text-xs text-primary hover:text-primary/80 bg-primary/10 rounded flex items-center space-x-1 transition-colors"
                >
                  <Sparkles size={11} />
                  <span>{t("updater.modal_title")}</span>
                </button>
                <a
                  href={updateInfo()?.release_url}
                  target="_blank"
                  rel="noreferrer"
                  class="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1"
                >
                  <span>{t("settings.changelog")}</span>
                  <ExternalLink size={11} />
                </a>
                <Show
                  when={downloadProgress()?.done || downloadedFilePath()}
                  fallback={
                    <button
                      disabled={isDownloading()}
                      onClick={handleStartUpdate}
                      class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Download size={13} class={isDownloading() ? "animate-bounce" : ""} />
                      <span>{isDownloading() ? t("settings.downloading") : t("settings.update_now")}</span>
                    </button>
                  }
                >
                  <button
                    disabled={isInstalling()}
                    onClick={handleInstallAndRestart}
                    class="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Zap size={13} class={isInstalling() ? "animate-spin" : ""} />
                    <span>{isInstalling() ? t("updater.installing") : t("updater.install_and_restart")}</span>
                  </button>
                </Show>
              </div>
            </div>

            {/* Progress Bar & Real-time Metrics */}
            <Show when={isDownloading() || downloadProgress()}>
              <div class="space-y-2 pt-1 border-t border-border/50">
                <div class="flex items-center justify-between text-[11px] font-mono">
                  <span class="text-muted-foreground flex items-center space-x-1.5">
                    <Show
                      when={downloadProgress()?.done || downloadedFilePath()}
                      fallback={<RefreshCw size={11} class="animate-spin text-primary" />}
                    >
                      <CheckCircle2 size={12} class="text-green-500" />
                    </Show>
                    <span>
                      {downloadProgress()?.done || downloadedFilePath()
                        ? t("updater.download_completed")
                        : downloadProgress()?.status || t("settings.downloading")}
                    </span>
                  </span>
                  <span class="text-primary font-bold">{Math.round(downloadProgress()?.percent || 0)}%</span>
                </div>

                <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    class="bg-primary h-full transition-all duration-150 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, downloadProgress()?.percent || 0))}%` }}
                  />
                </div>

                {/* Metrics: Downloaded / Total Size + Real-time Speed */}
                <div class="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-0.5">
                  <span class="flex items-center space-x-1">
                    <HardDrive size={11} class="text-primary" />
                    <span>
                      {formatBytes(downloadProgress()?.bytes_downloaded || 0)}
                      {downloadProgress()?.total_bytes ? ` / ${formatBytes(downloadProgress()?.total_bytes!)}` : ""}
                    </span>
                  </span>
                  <span class="flex items-center space-x-1">
                    <Gauge size={11} class="text-primary" />
                    <span>
                      {downloadProgress()?.done || downloadedFilePath()
                        ? "100%"
                        : formatSpeed(downloadProgress()?.speed_bytes_per_sec || 0)}
                    </span>
                  </span>
                </div>
              </div>
            </Show>

            {/* In-place install & silent checkbox */}
            <Show when={downloadProgress()?.done || downloadedFilePath()}>
              <div class="pt-2 border-t border-border/40 space-y-2 text-xs">
                <label class="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={silentInstall()}
                    onChange={(e) => setSilentInstall(e.currentTarget.checked)}
                    class="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span class="text-muted-foreground text-[11px]">
                    {t("updater.silent_install")}
                  </span>
                </label>
                <p class="text-[10px] text-muted-foreground italic">
                  {t("updater.install_tip")}
                </p>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Persistence / Data Folder */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-3">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <HardDrive size={15} class="text-primary" />
          <span>{t("settings.storage_title")}</span>
        </h2>

        <div class="space-y-1 text-xs">
          <label class="text-muted-foreground">{t("settings.storage_dir_label")}</label>
          <div class="flex items-center space-x-2">
            <div class="flex-1 p-2.5 bg-background border border-input rounded font-mono text-foreground flex items-center space-x-2">
              <FolderDot size={14} class="text-primary flex-shrink-0" />
              <span class="truncate">{dataDir() || "Not configured yet"}</span>
            </div>
            <button
              disabled={!dataDir()}
              onClick={async () => {
                const dir = dataDir();
                if (dir) {
                  try {
                    await revealInExplorer(dir);
                  } catch (e) {
                    console.warn("Reveal error:", e);
                  }
                }
              }}
              class="px-3 py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs flex items-center space-x-1.5 font-medium transition-colors disabled:opacity-50 border border-border"
            >
              <span>{t("settings.open_explorer")}</span>
            </button>
          </div>
          <p class="text-[11px] text-muted-foreground">
            {t("settings.storage_desc")}
          </p>

          {/* Backup & Restore Action Bar */}
          <div class="pt-2 border-t border-border flex items-center justify-between">
            <div>
              <span class="font-medium text-foreground text-xs block">{t("settings.backup_title")}</span>
              <span class="text-[11px] text-muted-foreground">{t("settings.backup_subtitle")}</span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                disabled={isExporting()}
                onClick={handleExportBackup}
                class="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded text-xs font-medium flex items-center space-x-1.5 border border-border transition-colors disabled:opacity-50"
              >
                <Copy size={13} class="text-primary" />
                <span>{isExporting() ? "Exporting..." : t("settings.export_btn")}</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                class="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <Upload size={13} />
                <span>{t("settings.restore_btn")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Backup Modal */}
      <Show when={showImportModal()}>
        <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div class="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <FileArchive size={16} class="text-primary" />
                <h3 class="font-bold text-sm text-foreground">{t("settings.restore_modal_title")}</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
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
              value={importJsonText()}
              onInput={(e) => setImportJsonText(e.currentTarget.value)}
              placeholder='Paste full backup JSON {"version": "0.1.0", ...} here...'
              class="w-full p-2.5 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />

            <div class="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-medium transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleImportBackup}
                class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Check size={14} />
                <span>{t("settings.confirm_restore")}</span>
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Appearance & Behavior */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-4">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <ShieldCheck size={15} class="text-primary" />
          <span>{t("settings.general")}</span>
        </h2>

        {/* Global Interface Language Selector */}
        <div class="space-y-2 p-3 bg-secondary/20 border border-border rounded-lg">
          <div class="flex items-center justify-between">
            <label class="font-semibold text-foreground flex items-center space-x-1.5">
              <Languages size={15} class="text-primary" />
              <span>{t("settings.language")}</span>
            </label>
            <span class="text-[10px] text-muted-foreground">{t("settings.language_desc")}</span>
          </div>

          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={async () => {
                await setLanguage("en");
                if (aiConfig()) {
                  await saveAIConfig({ ...aiConfig()!, language: "en" });
                }
                success(t("settings.saved_success"), "Interface language set to English (TheBerry AI)");
              }}
              class={`p-2.5 rounded-lg border text-left transition-all ${
                language() === "en"
                  ? "bg-primary/10 border-primary text-foreground font-semibold shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold text-foreground">English</span>
                <Show when={language() === "en"}>
                  <Check size={12} class="text-primary ml-auto" />
                </Show>
              </div>
              <p class="text-[10px] text-muted-foreground mt-0.5">Assistant name: TheBerry AI</p>
            </button>

            <button
              type="button"
              onClick={async () => {
                await setLanguage("zh");
                if (aiConfig()) {
                  await saveAIConfig({ ...aiConfig()!, language: "zh" });
                }
                success(t("settings.saved_success"), "界面语言已切换为简体中文 (豆花 AI)");
              }}
              class={`p-2.5 rounded-lg border text-left transition-all ${
                language() === "zh"
                  ? "bg-primary/10 border-primary text-foreground font-semibold shadow-xs"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold text-foreground">简体中文</span>
                <Show when={language() === "zh"}>
                  <Check size={12} class="text-primary ml-auto" />
                </Show>
              </div>
              <p class="text-[10px] text-muted-foreground mt-0.5">助手名称: 豆花 AI</p>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Theme */}
          <div class="space-y-2">
            <label class="font-medium text-foreground block">{t("settings.theme")}</label>
            <div class="flex space-x-2">
              <button
                onClick={() => {
                  setTheme("dark");
                  handleSave({ theme: "dark" });
                }}
                class={`flex-1 py-2 px-3 rounded flex items-center justify-center space-x-2 border transition-all ${
                  theme() === "dark"
                    ? "bg-primary/10 border-primary text-foreground font-semibold"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon size={14} />
                <span>{t("settings.theme_dark")}</span>
              </button>
              <button
                onClick={() => {
                  setTheme("light");
                  handleSave({ theme: "light" });
                }}
                class={`flex-1 py-2 px-3 rounded flex items-center justify-center space-x-2 border transition-all ${
                  theme() === "light"
                    ? "bg-primary/10 border-primary text-foreground font-semibold"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun size={14} />
                <span>{t("settings.theme_light")}</span>
              </button>
            </div>
          </div>

          {/* System Startup & Tray Behavior */}
          <div class="space-y-3">
            <label class="font-medium text-foreground block">{t("settings.system_startup")}</label>
            <div class="space-y-2">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autostartActive()}
                  onChange={(e) => handleToggleAutostart(e.currentTarget.checked)}
                  class="rounded"
                />
                <span class="text-muted-foreground">
                  {t("settings.autostart_desc")}
                </span>
              </label>

              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config().close_to_tray}
                  onChange={(e) => handleSave({ close_to_tray: e.currentTarget.checked })}
                  class="rounded"
                />
                <span class="text-muted-foreground">
                  {t("settings.close_to_tray_desc")}
                </span>
              </label>
            </div>
          </div>

          {/* QuickLook Integration (Windows Only) */}
          <div class="pt-3 border-t border-border space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-medium text-foreground flex items-center space-x-1.5">
                <Eye size={14} class="text-primary" />
                <span>{t("settings.quicklook")}</span>
              </label>
              <Show when={qlStatus()}>
                <span
                  class={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    qlStatus()?.is_running
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : qlStatus()?.is_installed
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {qlStatus()?.is_running
                    ? "Running (Named Pipe Active)"
                    : qlStatus()?.is_installed
                    ? "Installed (Standby)"
                    : qlStatus()?.is_supported_os
                    ? "Not Detected"
                    : "Not Supported on this OS"}
                </span>
              </Show>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              {t("settings.quicklook_desc")}
            </p>
            <Show when={qlStatus()?.is_supported_os && !qlStatus()?.is_installed}>
              <div class="pt-1">
                <a
                  href="https://github.com/QL-Win/QuickLook"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center space-x-1 text-xs text-primary hover:underline font-medium"
                >
                  <span>Download QuickLook from GitHub / Store</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </Show>
          </div>

          {/* Global Shortcuts & Quick Access HUD */}
          <div class="pt-3 border-t border-border space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-medium text-foreground flex items-center space-x-1.5">
                <Keyboard size={14} class="text-primary" />
                <span>{t("settings.shortcuts_hud")}</span>
              </label>
              <div class="flex items-center space-x-3">
                <HotkeyRecorder
                  currentShortcut={config().hud_shortcut || "Alt+Space"}
                  defaultShortcut="Alt+Space"
                  onSave={async (newShortcut) => {
                    await setHudShortcut(newShortcut);
                    await handleSave({ hud_shortcut: newShortcut });
                    success("Shortcut Updated", `HUD shortcut set to ${newShortcut}`);
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !config().global_shortcuts_enabled;
                    try {
                      await setGlobalShortcutsEnabled(nextVal);
                      await handleSave({ global_shortcuts_enabled: nextVal });
                      info(
                        nextVal ? "Global Shortcuts Enabled" : "Global Shortcuts Disabled",
                        nextVal ? "Press Alt+Space to open Quick Access HUD" : "Global hotkeys unregistered"
                      );
                    } catch (err: any) {
                      error("Shortcut Registration Failed", err?.message || String(err));
                    }
                  }}
                  class={`w-8 h-4 rounded-full transition-colors relative ${
                    config().global_shortcuts_enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    class={`w-3 h-3 rounded-full bg-white transition-transform ${
                      config().global_shortcuts_enabled ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              {t("settings.shortcuts_hud_desc")}
            </p>
          </div>

          {/* Clipboard Monitoring */}
          <div class="pt-3 border-t border-border space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-medium text-foreground flex items-center space-x-1.5">
                <ClipboardList size={14} class="text-primary" />
                <span>{t("settings.clipboard_monitor")}</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  const nextVal = !config().clipboard_monitor_enabled;
                  try {
                    await setClipboardMonitorEnabled(nextVal);
                    await handleSave({ clipboard_monitor_enabled: nextVal });
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
                class={`w-8 h-4 rounded-full transition-colors relative ${
                  config().clipboard_monitor_enabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <div
                  class={`w-3 h-3 rounded-full bg-white transition-transform ${
                    config().clipboard_monitor_enabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              {t("settings.clipboard_monitor_desc")}
            </p>
          </div>

          {/* AI Assistant Configuration (Goose / TheBerry) */}
          <div class="pt-3 border-t border-border space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-medium text-foreground flex items-center space-x-1.5">
                <Sparkles size={14} class="text-primary" />
                <span>{t("settings.ai_assistant")}</span>
              </label>
              <div class="flex items-center space-x-2">
                <Show when={aiConfig()}>
                  <span class="text-[10px] px-2 py-0.5 rounded font-mono bg-primary/10 text-primary border border-primary/20">
                    {aiConfig()?.active_provider.toUpperCase()} • {aiConfig()?.model} • {(aiConfig()?.request_format || "openai").toUpperCase()}
                  </span>
                </Show>
                <button
                  onClick={() => setShowAiModal(true)}
                  class="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                >
                  <Settings size={12} class="text-primary" />
                  <span>{t("settings.configure")}</span>
                </button>
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground leading-relaxed">
              {t("settings.ai_desc")}
            </p>
          </div>
        </div>
      </div>

      {/* Embedded AI Config Modal */}
      <GooseConfigModal
        isOpen={showAiModal()}
        onClose={() => {
          setShowAiModal(false);
          reloadSettings();
        }}
      />

      {/* About Box */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-2 text-xs">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <Info size={15} class="text-primary" />
          <span>About TheBerry</span>
        </h2>
        <p class="text-muted-foreground leading-relaxed">
          <strong>TheBerry</strong> is a modern personal desktop tool suite crafted with <strong>Tauri v2 + Rust</strong> on the backend and <strong>SolidJS + Tailwind CSS</strong> on the frontend.
        </p>
        <div class="pt-2 flex items-center space-x-4 text-[11px] text-muted-foreground">
          <span>Version: v{currentVersion()}</span>
          <span>•</span>
          <span>Repository: github.com/BerryUIKI/TheBerry</span>
        </div>
      </div>
    </div>
  );
}
