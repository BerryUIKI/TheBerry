import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { useTheme } from "../../context/ThemeContext";
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "../../services/system";
import { onUpdateAvailable, getAppVersion, checkForUpdates } from "../../services/updater";
import { UpdateInfo } from "../../types/updater";
import { useApp } from "../../context/AppContext";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { Sun, Moon, Minus, Square, Copy, X, Sparkles, Keyboard, Settings, RefreshCw } from "lucide-solid";

export function TitleBar() {
  const { theme, toggleTheme } = useTheme();
  const { activeView, setActiveView } = useApp();
  const { t, assistantName } = useI18n();
  const { success, info, error } = useToast();
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal("0.1.13");
  const [availableUpdate, setAvailableUpdate] = createSignal<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = createSignal(false);

  onMount(() => {
    getAppVersion()
      .then((ver) => {
        if (ver) setAppVersion(ver);
      })
      .catch((e) => {
        console.warn("Failed to fetch app version in TitleBar:", e);
      });

    let unlistenFn: (() => void) | null = null;
    onUpdateAvailable((info) => {
      setAvailableUpdate(info);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    onCleanup(() => {
      if (unlistenFn) unlistenFn();
    });
  });

  const handleMinimize = async () => {
    try {
      await minimizeWindow();
    } catch (e) {
      console.warn("Minimize failed:", e);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const maximized = await toggleMaximizeWindow();
      setIsMaximized(maximized);
    } catch (e) {
      console.warn("Toggle maximize failed:", e);
    }
  };

  const handleClose = async () => {
    try {
      await closeWindow();
    } catch (e) {
      console.warn("Close failed:", e);
    }
  };

  const handleCheckUpdate = async (e?: MouseEvent) => {
    e?.stopPropagation();
    if (isCheckingUpdate()) return;
    setIsCheckingUpdate(true);
    try {
      const releaseInfo = await checkForUpdates();
      if (releaseInfo.has_update) {
        setAvailableUpdate(releaseInfo);
        window.dispatchEvent(new CustomEvent("open-update-modal", { detail: releaseInfo }));
        success(
          t("titlebar.update_available_title"),
          t("titlebar.update_available_msg", { version: releaseInfo.latest_version })
        );
      } else {
        info(
          t("titlebar.up_to_date_title"),
          t("titlebar.up_to_date_msg", { version: releaseInfo.current_version || appVersion() })
        );
      }
    } catch (err: any) {
      console.error("Check for updates failed:", err);
      const msg = err?.message || String(err);
      error(t("titlebar.check_failed_title"), msg);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <header
      data-tauri-drag-region
      class="h-9 w-full bg-background border-b border-border flex items-center justify-between px-3 select-none flex-shrink-0 z-50"
    >
      {/* App Branding & Logo */}
      <div data-tauri-drag-region class="flex items-center space-x-2">
        <img
          src="/berry.png"
          alt="TheBerry Logo"
          class="w-4 h-4 rounded-full object-cover shadow-sm ring-1 ring-border"
        />
        <span class="text-xs font-semibold tracking-wider text-foreground uppercase opacity-90">
          TheBerry
        </span>
        <button
          type="button"
          onClick={handleCheckUpdate}
          disabled={isCheckingUpdate()}
          title={isCheckingUpdate() ? t("titlebar.checking_updates") : t("titlebar.check_updates_tooltip")}
          class="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted-foreground/20 active:scale-95 text-muted-foreground hover:text-foreground font-mono transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-60 disabled:cursor-wait border border-transparent hover:border-border/60"
        >
          <Show when={isCheckingUpdate()}>
            <RefreshCw size={10} class="animate-spin text-primary" />
          </Show>
          <span>v{appVersion()}</span>
        </button>

        {/* Update Notification Pill */}
        <Show when={availableUpdate()}>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-update-modal", { detail: availableUpdate() }));
            }}
            class="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-semibold flex items-center space-x-1 animate-pulse transition-colors"
          >
            <Sparkles size={10} />
            <span>{t("titlebar.update_available", { version: availableUpdate()?.latest_version || "" })}</span>
          </button>
        </Show>
      </div>

      {/* Drag Region spacer */}
      <div data-tauri-drag-region class="flex-1 h-full" />

      {/* Window Controls & Theme Toggle */}
      <div class="flex items-center space-x-1">
        {/* Goose AI Assistant Trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-goose-sidebar"))}
          title={`Toggle ${assistantName()} AI Assistant (Ctrl+J)`}
          class="h-6 px-2 flex items-center space-x-1.5 rounded-lg text-xs text-primary hover:text-primary-foreground hover:bg-primary transition-all active:scale-95 border border-primary/30 mr-1 shadow-sm"
        >
          <div class="w-3.5 h-3.5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
            <img src="/berry.png" alt={assistantName()} class="w-full h-full object-cover" />
          </div>
          <span class="text-[11px] font-semibold">{t("titlebar.ai_assistant")}</span>
        </button>

        {/* Shortcuts Cheat Sheet Trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-shortcuts"))}
          title={`${t("titlebar.shortcuts")} (? / F1)`}
          class="h-6 px-1.5 flex items-center space-x-1 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary transition-all active:scale-95 border border-border/40 mr-0.5"
        >
          <Keyboard size={12} class="text-primary" />
          <kbd class="text-[9px] px-1 py-0.2 rounded bg-muted font-mono">?</kbd>
        </button>

        {/* Spotlight Quick Search Trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-spotlight"))}
          title={`${t("titlebar.search")} (Ctrl+K)`}
          class="h-6 px-2 flex items-center space-x-1.5 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all active:scale-95 border border-border/50 mr-1"
        >
          <span class="text-[11px] font-medium">{t("titlebar.search")}</span>
          <kbd class="text-[9px] px-1 py-0.2 rounded bg-muted font-mono">Ctrl+K</kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme() === "dark" ? t("titlebar.switch_light") : t("titlebar.switch_dark")}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
        >
          {theme() === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setActiveView("settings")}
          title={t("nav.settings")}
          class={`w-7 h-7 flex items-center justify-center rounded transition-all active:scale-90 ${
            activeView() === "settings"
              ? "text-primary bg-secondary/80 font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <Settings size={14} />
        </button>

        <div class="h-4 w-[1px] bg-border mx-1" />

        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          title={t("titlebar.minimize")}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
        >
          <Minus size={13} />
        </button>

        {/* Maximize / Restore Button */}
        <button
          onClick={handleToggleMaximize}
          title={isMaximized() ? t("titlebar.restore") : t("titlebar.maximize")}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
        >
          {isMaximized() ? <Copy size={12} /> : <Square size={12} />}
        </button>

        {/* Close / Hide Button */}
        <button
          onClick={handleClose}
          title={t("titlebar.close")}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-all active:scale-90"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
