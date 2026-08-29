import { createSignal, onMount } from "solid-js";
import { useApp } from "../../context/AppContext";
import { Folder, HardDrive, CheckCircle2, AlertCircle } from "lucide-solid";

export function FirstLaunchModal() {
  const { suggestedDataDir, confirmDataDirectory, showSetupModal } = useApp();
  const [customPath, setCustomPath] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    setCustomPath(suggestedDataDir() || "Documents/BerryAppData");
  });

  const handlePickDirectory = async () => {
    try {
      // Dynamic import to avoid SSR / bundler edge cases
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Berry App Data Storage Directory",
        defaultPath: customPath() || suggestedDataDir(),
      });
      if (selected && typeof selected === "string") {
        setCustomPath(selected);
      }
    } catch (e) {
      console.warn("Folder picker not available in browser mode, edit manually:", e);
    }
  };

  const handleConfirm = async () => {
    const path = customPath().trim();
    if (!path) {
      setError("Please specify a valid storage directory path.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await confirmDataDirectory(path);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!showSetupModal()) {
    return null;
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div class="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="p-6 border-b border-border bg-gradient-to-r from-primary/10 via-background to-background">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <HardDrive size={22} />
            </div>
            <div>
              <h2 class="text-base font-semibold text-foreground">Welcome to TheBerry</h2>
              <p class="text-xs text-muted-foreground mt-0.5">
                Choose where to store your personal tool data & configuration
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div class="p-6 space-y-4 text-xs">
          <div class="p-3 bg-secondary/50 rounded-lg border border-border/80 text-muted-foreground leading-relaxed">
            <span class="font-medium text-foreground">Data Storage Policy:</span> TheBerry operates with full data ownership. All embedded database tables (<code>redb</code>), snippets, clipboard cache, and application settings reside in this root folder.
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-foreground">
              Root Data Directory:
            </label>
            <div class="flex items-center space-x-2">
              <input
                type="text"
                value={customPath()}
                onInput={(e) => setCustomPath(e.currentTarget.value)}
                placeholder="e.g. C:\Users\YourName\Documents\BerryAppData"
                class="flex-1 px-3 py-2 bg-background border border-input rounded-md font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handlePickDirectory}
                class="px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md flex items-center space-x-1.5 font-medium transition-colors"
              >
                <Folder size={14} />
                <span>Browse</span>
              </button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Default suggested: <code class="text-primary">{suggestedDataDir()}</code>
            </p>
          </div>

          {error() && (
            <div class="flex items-center space-x-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs">
              <AlertCircle size={15} class="flex-shrink-0" />
              <span>{error()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div class="p-4 bg-muted/40 border-t border-border flex justify-end items-center space-x-2">
          <button
            type="button"
            disabled={loading()}
            onClick={handleConfirm}
            class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-md shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {loading() ? (
              <span>Initializing...</span>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Initialize & Get Started</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
