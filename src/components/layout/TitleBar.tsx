import { createSignal } from "solid-js";
import { useTheme } from "../../context/ThemeContext";
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "../../services/system";
import { Sun, Moon, Minus, Square, Copy, X } from "lucide-solid";

export function TitleBar() {
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
    <header
      data-tauri-drag-region
      class="h-9 w-full bg-background border-b border-border flex items-center justify-between px-3 select-none flex-shrink-0 z-50"
    >
      {/* App Branding & Logo */}
      <div data-tauri-drag-region class="flex items-center space-x-2">
        <div class="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">
          B
        </div>
        <span class="text-xs font-semibold tracking-wider text-foreground uppercase opacity-90">
          TheBerry
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
          v0.1.0-dev
        </span>
      </div>

      {/* Drag Region spacer */}
      <div data-tauri-drag-region class="flex-1 h-full" />

      {/* Window Controls & Theme Toggle */}
      <div class="flex items-center space-x-1">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme() === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {theme() === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div class="h-4 w-[1px] bg-border mx-1" />

        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Minus size={13} />
        </button>

        {/* Maximize / Restore Button */}
        <button
          onClick={handleToggleMaximize}
          title={isMaximized() ? "Restore" : "Maximize"}
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {isMaximized() ? <Copy size={12} /> : <Square size={12} />}
        </button>

        {/* Close / Hide Button */}
        <button
          onClick={handleClose}
          title="Close (Hide to Tray)"
          class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
