import { createSignal, onMount } from "solid-js";
import { AppConfig } from "../types/config";
import { getConfig, updateConfig } from "../services/system";
import { useApp } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import {
  Settings,
  FolderDot,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Info,
} from "lucide-solid";

export function SettingsView() {
  const { dataDir } = useApp();
  const { theme, setTheme } = useTheme();
  const [config, setConfigState] = createSignal<AppConfig>({
    version: "0.1.0",
    theme: "dark",
    close_to_tray: true,
    autostart: false,
    clipboard_history_limit: 200,
    custom_data_dir: "",
  });
  const [savedMessage, setSavedMessage] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const cfg = await getConfig();
      setConfigState(cfg);
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
  });

  const handleSave = async (updated: Partial<AppConfig>) => {
    const current = { ...config(), ...updated };
    setConfigState(current);
    try {
      await updateConfig(current);
      setSavedMessage("Settings saved successfully");
      setTimeout(() => setSavedMessage(null), 2000);
    } catch (e) {
      console.error("Failed to update config:", e);
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
          Manage system preferences, persistence paths, and appearance
        </p>
      </div>

      {/* Save alert */}
      {savedMessage() && (
        <div class="flex items-center space-x-2 p-2.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-md text-xs">
          <CheckCircle2 size={14} />
          <span>{savedMessage()}</span>
        </div>
      )}

      {/* Persistence / Data Folder */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-3">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <HardDrive size={15} class="text-primary" />
          <span>Storage & Persistence (redb + TOML)</span>
        </h2>

        <div class="space-y-1 text-xs">
          <label class="text-muted-foreground">Configured Root Storage Directory:</label>
          <div class="p-2.5 bg-background border border-input rounded font-mono text-foreground flex items-center space-x-2">
            <FolderDot size={14} class="text-primary flex-shrink-0" />
            <span class="truncate">{dataDir() || "Not configured yet"}</span>
          </div>
          <p class="text-[11px] text-muted-foreground">
            Contains <code>the_berry.redb</code> embedded database and <code>config.toml</code>. All tool tables and data remain local and offline.
          </p>
        </div>
      </div>

      {/* Appearance & Behavior */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-4">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <ShieldCheck size={15} class="text-primary" />
          <span>Window & System Behavior</span>
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Theme */}
          <div class="space-y-2">
            <label class="font-medium text-foreground block">Appearance Theme</label>
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
                <span>Dark Mode</span>
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
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Close to tray */}
          <div class="space-y-2">
            <label class="font-medium text-foreground block">System Tray Behavior</label>
            <label class="flex items-center space-x-2 cursor-pointer mt-3">
              <input
                type="checkbox"
                checked={config().close_to_tray}
                onChange={(e) => handleSave({ close_to_tray: e.currentTarget.checked })}
                class="rounded"
              />
              <span class="text-muted-foreground">
                Minimize / close to system tray instead of exiting
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* About Box */}
      <div class="p-4 bg-card border border-border rounded-lg space-y-2 text-xs">
        <h2 class="text-xs font-semibold text-foreground flex items-center space-x-2">
          <Info size={15} class="text-primary" />
          <span>About TheBerry</span>
        </h2>
        <p class="text-muted-foreground leading-relaxed">
          <strong>TheBerry</strong> is a modern personal tool suite crafted with <strong>Tauri v2 + Rust</strong> on the backend and <strong>SolidJS + Tailwind CSS</strong> on the frontend.
        </p>
        <div class="pt-2 flex items-center space-x-4 text-[11px] text-muted-foreground">
          <span>Version: 0.1.0-dev</span>
          <span>•</span>
          <span>Repository: github.com/BerryUIKI/TheBerry</span>
        </div>
      </div>
    </div>
  );
}
