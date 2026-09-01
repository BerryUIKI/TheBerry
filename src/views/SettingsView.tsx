import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { AppConfig } from "../types/config";
import { getConfig, updateConfig } from "../services/system";
import { revealInExplorer } from "../services/fileSearch";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  getAppVersion,
  onDownloadProgress,
} from "../services/updater";
import { isAutostartEnabled, setAutostart } from "../services/autostart";
import { exportFullBackup, importFullBackup } from "../services/backup";
import { copyToSystemClipboard } from "../services/clipboard";
import { getQuickLookStatus } from "../services/quicklook";
import { setGlobalShortcutsEnabled, setHudShortcut } from "../services/shortcuts";
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
} from "lucide-solid";

export function SettingsView() {
  const { success, error, info } = useToast();
  const { dataDir } = useApp();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage, assistantName } = useI18n();
  const [config, setConfigState] = createSignal<AppConfig>({
    version: "0.1.3",
    theme: "dark",
    language: "en",
    close_to_tray: true,
    autostart: false,
    clipboard_history_limit: 200,
    custom_data_dir: "",
  });
  const [autostartActive, setAutostartActive] = createSignal(false);
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [importJsonText, setImportJsonText] = createSignal("");
  const [isExporting, setIsExporting] = createSignal(false);
  const [savedMessage, setSavedMessage] = createSignal<string | null>(null);

  // Updater State
  const [currentVersion, setCurrentVersion] = createSignal("0.1.3");
  const [checkingUpdate, setCheckingUpdate] = createSignal(false);
  const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = createSignal<string | null>(null);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);
  const [qlStatus, setQlStatus] = createSignal<QuickLookStatus | null>(null);
  const [aiConfig, setAiConfig] = createSignal<AIConfig | null>(null);
  const [showAiModal, setShowAiModal] = createSignal(false);

  const reloadSettings = async () => {
    try {
      const cfg = await getConfig();
      setConfigState(cfg);
      const ver = await getAppVersion();
      setCurrentVersion(ver);
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
      await downloadAndInstallUpdate(info.download_url);
    } catch (err: any) {
      setUpdateError(err.message || String(err));
      setIsDownloading(false);
    }
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-5 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
          <Settings class="text-primary" size={20} />
          <span>Application Settings</span>
        </h1>
        <p class="text-xs text-muted-foreground mt-0.5">
          Manage system preferences, version updates, persistence paths, and appearance
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
            <span>Version & Automatic Updates</span>
          </h2>
          <button
            disabled={checkingUpdate() || isDownloading()}
            onClick={handleCheckUpdate}
            class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors border border-border disabled:opacity-50"
          >
            <RefreshCw size={13} class={checkingUpdate() ? "animate-spin" : ""} />
            <span>{checkingUpdate() ? "Checking..." : "Check for Updates"}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="p-3 bg-background border border-border rounded flex items-center justify-between">
            <span class="text-muted-foreground">Installed Version:</span>
            <span class="font-mono font-semibold text-foreground">v{currentVersion()}</span>
          </div>

          <div class="p-3 bg-background border border-border rounded flex items-center justify-between">
            <span class="text-muted-foreground">Update Status:</span>
            <Show
              when={updateInfo()}
              fallback={<span class="text-muted-foreground">Daily silent check enabled</span>}
            >
              {updateInfo()?.has_update ? (
                <span class="font-semibold text-primary flex items-center space-x-1">
                  <span>v{updateInfo()?.latest_version} Available</span>
                </span>
              ) : (
                <span class="text-green-500 font-medium">Up to date</span>
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
          <div class="p-3.5 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-xs font-bold text-foreground flex items-center space-x-1.5">
                  <Sparkles size={14} class="text-primary" />
                  <span>New Release {updateInfo()?.latest_version} Available</span>
                </h3>
                <Show when={updateInfo()?.asset_name}>
                  <p class="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Package: {updateInfo()?.asset_name}
                  </p>
                </Show>
              </div>

              <div class="flex items-center space-x-2">
                <a
                  href={updateInfo()?.release_url}
                  target="_blank"
                  rel="noreferrer"
                  class="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1"
                >
                  <span>Changelog</span>
                  <ExternalLink size={11} />
                </a>
                <button
                  disabled={isDownloading()}
                  onClick={handleStartUpdate}
                  class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Download size={13} />
                  <span>{isDownloading() ? "Downloading..." : "Update Now"}</span>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <Show when={downloadProgress()}>
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>{downloadProgress()?.status}</span>
                  <span>{Math.round(downloadProgress()?.percent || 0)}%</span>
                </div>
                <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    class="bg-primary h-full transition-all duration-150"
                    style={{ width: `${downloadProgress()?.percent || 0}%` }}
                  />
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Persistence / Data Folder */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-3">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <HardDrive size={15} class="text-primary" />
          <span>Storage & Persistence (redb + TOML)</span>
        </h2>

        <div class="space-y-1 text-xs">
          <label class="text-muted-foreground">Configured Root Storage Directory:</label>
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
              <span>Open in Explorer</span>
            </button>
          </div>
          <p class="text-[11px] text-muted-foreground">
            Contains <code>the_berry.redb</code> embedded database and <code>config.toml</code>. All tool tables and data remain local and offline.
          </p>

          {/* Backup & Restore Action Bar */}
          <div class="pt-2 border-t border-border flex items-center justify-between">
            <div>
              <span class="font-medium text-foreground text-xs block">Data Backup & Portability</span>
              <span class="text-[11px] text-muted-foreground">Export or restore all database records and preferences as JSON</span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                disabled={isExporting()}
                onClick={handleExportBackup}
                class="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded text-xs font-medium flex items-center space-x-1.5 border border-border transition-colors disabled:opacity-50"
              >
                <Copy size={13} class="text-primary" />
                <span>{isExporting() ? "Exporting..." : "Export Backup JSON"}</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                class="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <Upload size={13} />
                <span>Restore Backup</span>
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
                <h3 class="font-bold text-sm text-foreground">Restore Full Backup</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                class="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-muted-foreground">
              Paste the exported JSON backup below. This will merge and restore all clipboard history, code snippets, launcher items, and application preferences.
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
                Cancel
              </button>
              <button
                onClick={handleImportBackup}
                class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Check size={14} />
                <span>Confirm Restore</span>
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
            <label class="font-medium text-foreground block">System & Startup Behavior</label>
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
                <div class="flex items-center space-x-1">
                  <kbd class="px-2 py-0.5 rounded bg-secondary text-foreground border border-border text-[11px] font-mono font-semibold shadow-xs">
                    {config().hud_shortcut || "Alt+Space"}
                  </kbd>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !config().global_shortcuts_enabled;
                    await handleSave({ global_shortcuts_enabled: nextVal });
                    await setGlobalShortcutsEnabled(nextVal);
                    info(
                      nextVal ? "Global Shortcuts Enabled" : "Global Shortcuts Disabled",
                      nextVal ? "Press Alt+Space to open Quick Access HUD" : "Global hotkeys unregistered"
                    );
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
