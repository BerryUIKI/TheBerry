import { createSignal } from "solid-js";
import { SettingsView } from "./SettingsView";
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "../services/system";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { ToastContainer } from "../components/ToastContainer";
import { Minus, Square, Copy, X, Sun, Moon, Settings } from "lucide-solid";

export function SettingsWindow() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isMaximized, setIsMaximized] = createSignal(false);

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

  return (
    <div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      {/* Standalone Frameless Titlebar */}
      <header
        data-tauri-drag-region
        class="h-9 w-full bg-background border-b border-border flex items-center justify-between px-3 flex-shrink-0 z-50"
      >
        {/* Branding & Window Title */}
        <div data-tauri-drag-region class="flex items-center space-x-2">
          <Settings size={14} class="text-primary" />
          <span class="text-xs font-bold text-foreground tracking-tight">
            {t("settings.standalone_title")}
          </span>
        </div>

        {/* Drag spacer */}
        <div data-tauri-drag-region class="flex-1 h-full" />

        {/* Window controls & theme toggle */}
        <div class="flex items-center space-x-1">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme() === "dark" ? t("titlebar.switch_light") : t("titlebar.switch_dark")}
            class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
          >
            {theme() === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          <div class="h-4 w-[1px] bg-border mx-1" />

          <button
            type="button"
            onClick={handleMinimize}
            title={t("titlebar.minimize")}
            class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
          >
            <Minus size={13} />
          </button>

          <button
            type="button"
            onClick={handleToggleMaximize}
            title={isMaximized() ? t("titlebar.restore") : t("titlebar.maximize")}
            class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
          >
            {isMaximized() ? <Copy size={11} /> : <Square size={11} />}
          </button>

          <button
            type="button"
            onClick={handleClose}
            title={t("titlebar.close")}
            class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-all active:scale-90"
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {/* Main Settings Canvas */}
      <div class="flex-1 overflow-hidden">
        <SettingsView isStandalone={true} />
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
