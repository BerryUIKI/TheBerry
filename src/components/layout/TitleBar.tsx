import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { useTheme } from "../../context/ThemeContext";
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "../../services/system";
import { onUpdateAvailable } from "../../services/updater";
import { UpdateInfo } from "../../types/updater";
import { useApp } from "../../context/AppContext";
import { Sun, Moon, Minus, Square, Copy, X, Sparkles, Keyboard, Bot } from "lucide-solid";

export function TitleBar() {
  const { theme, toggleTheme } = useTheme();
  const { setActiveView } = useApp();
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [availableUpdate, setAvailableUpdate] = createSignal<UpdateInfo | null>(null);

  onMount(() => {
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
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
          v0.1.2
        </span>

        {/* Update Notification Pill */}
        <Show when={availableUpdate()}>
          <button
            onClick={() => setActiveView("settings")}
            class="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-semibold flex items-center space-x-1 animate-pulse transition-colors"
          >
            <Sparkles size={10} />
            <span>Update {availableUpdate()?.latest_version} Available</span>
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
          title="Toggle Goose AI Assistant (Ctrl+J)"
          class="h-6 px-2 flex items-center space-x-1 rounded text-xs text-primary hover:text-primary-foreground hover:bg-primary transition-all active:scale-95 border border-primary/30 mr-1 shadow-sm"
        >
          <Bot size={13} class="animate-pulse" />
          <span class="text-[11px] font-semibold">AI Chat</span>
        </button>

        {/* Shortcuts Cheat Sheet Trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-shortcuts"))}
          title="Keyboard Shortcuts (? / F1)"
          class="h-6 px-1.5 flex items-center space-x-1 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary transition-all active:scale-95 border border-border/40 mr-0.5"
        >
          <Keyboard size={12} class="text-primary" />
          <kbd class="text-[9px] px-1 py-0.2 rounded bg-muted font-mono">?</kbd>
        </button>

        {/* Spotlight Quick Search Trigger */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-spotlight"))}
          title="Spotlight Search (Ctrl+K)"
          class="h-6 px-2 flex items-center space-x-1.5 rounded text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all active:scale-95 border border-border/50 mr-1"
        >
          <span class="text-[11px] font-medium">Search</span>
          <kbd class="text-[9px] px-1 py-0.2 rounded bg-muted font-mono">Ctrl+K</kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme() === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
        >
          {theme() === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div class="h-4 w-[1px] bg-border mx-1" />

        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
        >
          <Minus size={13} />
        </button>

        {/* Maximize / Restore Button */}
        <button
          onClick={handleToggleMaximize}
          title={isMaximized() ? "Restore" : "Maximize"}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
        >
          {isMaximized() ? <Copy size={12} /> : <Square size={12} />}
        </button>

        {/* Close / Hide Button */}
        <button
          onClick={handleClose}
          title="Close (Hide to Tray)"
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-all active:scale-90"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
