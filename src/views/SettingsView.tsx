import { createSignal, onMount, onCleanup, Show, Switch, Match } from "solid-js";
import { AppConfig } from "../types/config";
import { SettingsCategory } from "../types/settings";
import { getConfig, updateConfig, openSettingsWindow } from "../services/system";
import {
  checkForUpdates,
  downloadUpdate,
  installAndRestart,
  getAppVersion,
  onDownloadProgress,
} from "../services/updater";
import { isAutostartEnabled, setAutostart } from "../services/autostart";
import { exportFullBackup, importFullBackup } from "../services/backup";
import { copyToSystemClipboard } from "../services/clipboard";
import {
  getQuickLookStatus,
  setQuickLookEnabled,
  startQuickLook,
  stopQuickLook,
  previewWithQuickLook,
  onQuickLookStatusChanged,
} from "../services/quicklook";
import { GooseConfigModal } from "../components/goose/GooseConfigModal";
import { getAIConfig } from "../services/goose";
import { QuickLookStatus } from "../types/quicklook";
import { AIConfig } from "../types/goose";
import { DownloadProgress, UpdateInfo } from "../types/updater";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";

import { SettingsSidebar, SETTINGS_CATEGORIES } from "../components/settings/SettingsSidebar";
import { GeneralSection } from "../components/settings/sections/GeneralSection";
import { ShortcutsSection } from "../components/settings/sections/ShortcutsSection";
import { QuickLookSection } from "../components/settings/sections/QuickLookSection";
import { AISection } from "../components/settings/sections/AISection";
import { ClipboardSection } from "../components/settings/sections/ClipboardSection";
import { StorageSection } from "../components/settings/sections/StorageSection";
import { AboutSection } from "../components/settings/sections/AboutSection";

interface SettingsViewProps {
  isStandalone?: boolean;
}

export function SettingsView(props: SettingsViewProps) {
  const { success, error, info } = useToast();
  const { dataDir, returnToPreviousView } = useApp();
  const { t } = useI18n();

  const [activeCategory, setActiveCategory] = createSignal<SettingsCategory>("general");
  const [searchQuery, setSearchQuery] = createSignal("");

  const [config, setConfigState] = createSignal<AppConfig>({
    version: "0.1.13",
    theme: "dark",
    language: "en",
    close_to_tray: true,
    autostart: false,
    global_shortcuts_enabled: true,
    hud_shortcut: "Alt+Space",
    clipboard_history_limit: 200,
    clipboard_monitor_enabled: false,
    quicklook_enabled: true,
    custom_data_dir: "",
  });

  const [autostartActive, setAutostartActive] = createSignal(false);
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [importJsonText, setImportJsonText] = createSignal("");
  const [isExporting, setIsExporting] = createSignal(false);

  // Updater State
  const [currentVersion, setCurrentVersion] = createSignal("0.1.13");
  const [checkingUpdate, setCheckingUpdate] = createSignal(false);
  const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = createSignal<string | null>(null);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal<DownloadProgress | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = createSignal<string | null>(null);
  const [isInstalling, setIsInstalling] = createSignal(false);

  // QuickLook State
  const [qlStatus, setQlStatus] = createSignal<QuickLookStatus | null>(null);
  const [isStartingQl, setIsStartingQl] = createSignal(false);

  // AI State
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

    let unlistenProgFn: (() => void) | null = null;
    let unlistenQlFn: (() => void) | null = null;

    onDownloadProgress((prog) => {
      setDownloadProgress(prog);
      if (prog.done) {
        setIsDownloading(false);
        if (prog.file_path) {
          setDownloadedFilePath(prog.file_path);
        }
      }
    }).then((unlisten) => {
      unlistenProgFn = unlisten;
    });

    onQuickLookStatusChanged((status) => {
      setQlStatus(status);
      setConfigState((prev) => ({ ...prev, quicklook_enabled: status.is_enabled }));
    }).then((unlisten) => {
      unlistenQlFn = unlisten;
    });

    onCleanup(() => {
      if (unlistenProgFn) unlistenProgFn();
      if (unlistenQlFn) unlistenQlFn();
    });
  });

  const handleSave = async (updated: Partial<AppConfig>) => {
    const current = { ...config(), ...updated };
    setConfigState(current);
    try {
      await updateConfig(current);
      success("Settings Saved");
    } catch (e) {
      error("Failed to save settings", String(e));
    }
  };

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
      success("Backup JSON Copied", "Full backup data copied to clipboard!");
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

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    try {
      const releaseInfo = await checkForUpdates();
      setUpdateInfo(releaseInfo);
      if (releaseInfo.has_update) {
        success(
          t("titlebar.update_available_title"),
          t("titlebar.update_available_msg", { version: releaseInfo.latest_version })
        );
      } else {
        info(
          t("titlebar.up_to_date_title"),
          t("titlebar.up_to_date_msg", { version: releaseInfo.current_version })
        );
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setUpdateError(msg);
      error(t("titlebar.check_failed_title"), msg);
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
      await installAndRestart(downloadedFilePath() || undefined, true);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setUpdateError(msg);
      error("Install Failed", msg);
      setIsInstalling(false);
    }
  };

  const handleToggleQuickLook = async (checked: boolean) => {
    try {
      const updated = await setQuickLookEnabled(checked);
      setQlStatus(updated);
      await handleSave({ quicklook_enabled: checked });
      if (checked) {
        success(t("settings.quicklook"), t("settings.quicklook_running"));
      } else {
        info(t("settings.quicklook"), t("settings.quicklook_disabled"));
      }
    } catch (err: any) {
      error("QuickLook Error", err.message || String(err));
    }
  };

  const handleStartQuickLook = async () => {
    setIsStartingQl(true);
    try {
      const status = await startQuickLook();
      setQlStatus(status);
      success(t("settings.quicklook"), t("settings.quicklook_running"));
    } catch (err: any) {
      error("QuickLook Start Failed", err.message || String(err));
    } finally {
      setIsStartingQl(false);
    }
  };

  const handleStopQuickLook = async () => {
    setIsStartingQl(true);
    try {
      const status = await stopQuickLook();
      setQlStatus(status);
      info(t("settings.quicklook"), t("settings.quicklook_stopped"));
    } catch (err: any) {
      error("QuickLook Stop Failed", err.message || String(err));
    } finally {
      setIsStartingQl(false);
    }
  };

  const handleTestPreview = async () => {
    try {
      await previewWithQuickLook("README.md");
    } catch (err: any) {
      error("Test Preview Failed", err.message || String(err));
    }
  };

  const handleBackToWorkspace = () => {
    returnToPreviousView();
  };

  const handleOpenStandalone = async () => {
    try {
      await openSettingsWindow();
      if (!props.isStandalone) {
        returnToPreviousView();
      }
    } catch (err: any) {
      error("Failed to open standalone settings window", err?.message || String(err));
    }
  };

  const matchesCategory = (category: SettingsCategory) => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return true;
    const item = SETTINGS_CATEGORIES.find((c) => c.id === category);
    if (!item) return false;
    const localizedLabel = t(item.labelKey as any).toLowerCase();
    return (
      localizedLabel.includes(query) ||
      item.keywords.some((k) => k.toLowerCase().includes(query)) ||
      category.includes(query)
    );
  };

  const totalMatches = () => {
    return SETTINGS_CATEGORIES.filter((c) => matchesCategory(c.id)).length;
  };

  return (
    <div class="h-full w-full flex bg-background text-foreground overflow-hidden select-text">
      {/* Dedicated Settings Sidebar */}
      <SettingsSidebar
        activeCategory={activeCategory()}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setSearchQuery("");
        }}
        searchQuery={searchQuery()}
        onSearchChange={setSearchQuery}
        isStandalone={props.isStandalone}
        onBack={handleBackToWorkspace}
        onOpenStandalone={handleOpenStandalone}
      />

      {/* Main Settings Content Pane */}
      <main class="flex-1 h-full overflow-y-auto p-6 space-y-6">
        <Show
          when={searchQuery().trim()}
          fallback={
            <div class="max-w-3xl space-y-6">
              <Switch>
                <Match when={activeCategory() === "general"}>
                  <GeneralSection
                    config={config}
                    handleSave={handleSave}
                    autostartActive={autostartActive}
                    handleToggleAutostart={handleToggleAutostart}
                    aiConfig={aiConfig}
                  />
                </Match>

                <Match when={activeCategory() === "shortcuts"}>
                  <ShortcutsSection
                    config={config}
                    handleSave={handleSave}
                  />
                </Match>

                <Match when={activeCategory() === "quicklook"}>
                  <QuickLookSection
                    config={config}
                    qlStatus={qlStatus}
                    isStartingQl={isStartingQl}
                    handleToggleQuickLook={handleToggleQuickLook}
                    handleStartQuickLook={handleStartQuickLook}
                    handleStopQuickLook={handleStopQuickLook}
                    handleTestPreview={handleTestPreview}
                  />
                </Match>

                <Match when={activeCategory() === "ai"}>
                  <AISection
                    aiConfig={aiConfig}
                    onOpenModal={() => setShowAiModal(true)}
                  />
                </Match>

                <Match when={activeCategory() === "clipboard"}>
                  <ClipboardSection
                    config={config}
                    handleSave={handleSave}
                  />
                </Match>

                <Match when={activeCategory() === "storage"}>
                  <StorageSection
                    dataDir={dataDir}
                    handleExportBackup={handleExportBackup}
                    handleImportBackup={handleImportBackup}
                    showImportModal={showImportModal}
                    setShowImportModal={setShowImportModal}
                    importJsonText={importJsonText}
                    setImportJsonText={setImportJsonText}
                    isExporting={isExporting}
                  />
                </Match>

                <Match when={activeCategory() === "about"}>
                  <AboutSection
                    currentVersion={currentVersion}
                    checkingUpdate={checkingUpdate}
                    updateInfo={updateInfo}
                    updateError={updateError}
                    isDownloading={isDownloading}
                    downloadProgress={downloadProgress}
                    downloadedFilePath={downloadedFilePath}
                    isInstalling={isInstalling}
                    handleCheckUpdate={handleCheckUpdate}
                    handleStartUpdate={handleStartUpdate}
                    handleInstallAndRestart={handleInstallAndRestart}
                  />
                </Match>
              </Switch>
            </div>
          }
        >
          {/* Search Results Filtered View */}
          <div class="max-w-3xl space-y-8">
            <Show when={matchesCategory("general")}>
              <GeneralSection
                config={config}
                handleSave={handleSave}
                autostartActive={autostartActive}
                handleToggleAutostart={handleToggleAutostart}
                aiConfig={aiConfig}
              />
            </Show>

            <Show when={matchesCategory("shortcuts")}>
              <ShortcutsSection
                config={config}
                handleSave={handleSave}
              />
            </Show>

            <Show when={matchesCategory("quicklook")}>
              <QuickLookSection
                config={config}
                qlStatus={qlStatus}
                isStartingQl={isStartingQl}
                handleToggleQuickLook={handleToggleQuickLook}
                handleStartQuickLook={handleStartQuickLook}
                handleStopQuickLook={handleStopQuickLook}
                handleTestPreview={handleTestPreview}
              />
            </Show>

            <Show when={matchesCategory("ai")}>
              <AISection
                aiConfig={aiConfig}
                onOpenModal={() => setShowAiModal(true)}
              />
            </Show>

            <Show when={matchesCategory("clipboard")}>
              <ClipboardSection
                config={config}
                handleSave={handleSave}
              />
            </Show>

            <Show when={matchesCategory("storage")}>
              <StorageSection
                dataDir={dataDir}
                handleExportBackup={handleExportBackup}
                handleImportBackup={handleImportBackup}
                showImportModal={showImportModal}
                setShowImportModal={setShowImportModal}
                importJsonText={importJsonText}
                setImportJsonText={setImportJsonText}
                isExporting={isExporting}
              />
            </Show>

            <Show when={matchesCategory("about")}>
              <AboutSection
                currentVersion={currentVersion}
                checkingUpdate={checkingUpdate}
                updateInfo={updateInfo}
                updateError={updateError}
                isDownloading={isDownloading}
                downloadProgress={downloadProgress}
                downloadedFilePath={downloadedFilePath}
                isInstalling={isInstalling}
                handleCheckUpdate={handleCheckUpdate}
                handleStartUpdate={handleStartUpdate}
                handleInstallAndRestart={handleInstallAndRestart}
              />
            </Show>

            <Show when={totalMatches() === 0}>
              <div class="py-16 text-center text-muted-foreground text-xs space-y-2">
                <p class="font-medium text-foreground">{t("settings.no_search_results")}</p>
                <p>Try searching for words like &ldquo;theme&rdquo;, &ldquo;quicklook&rdquo;, &ldquo;hotkey&rdquo;, or &ldquo;backup&rdquo;.</p>
              </div>
            </Show>
          </div>
        </Show>
      </main>

      {/* AI Assistant Config Modal */}
      <GooseConfigModal
        isOpen={showAiModal()}
        onClose={() => {
          setShowAiModal(false);
          reloadSettings();
        }}
      />
    </div>
  );
}
