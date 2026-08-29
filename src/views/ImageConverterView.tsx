import { createSignal, For, Show } from "solid-js";
import { ConvertResult, ConvertTask } from "../types/imageConverter";
import { convertImages } from "../services/imageConverter";
import {
  Image as ImageIcon,
  FolderOpen,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  RefreshCw,
} from "lucide-solid";

export function ImageConverterView() {
  const [selectedPaths, setSelectedPaths] = createSignal<string[]>([]);
  const [targetFormat, setTargetFormat] = createSignal<"webp" | "png" | "jpeg">("webp");
  const [quality, setQuality] = createSignal<number>(85);
  const [outputDir, setOutputDir] = createSignal<string>("");
  const [converting, setConverting] = createSignal(false);
  const [results, setResults] = createSignal<ConvertResult[]>([]);

  const handlePickFiles = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff"],
          },
        ],
      });
      if (selected && Array.isArray(selected)) {
        setSelectedPaths(selected);
      } else if (selected && typeof selected === "string") {
        setSelectedPaths([selected]);
      }
    } catch (e) {
      console.warn("Folder picker not available in web preview:", e);
    }
  };

  const handlePickOutputDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Output Directory",
      });
      if (selected && typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch (e) {
      console.warn("Folder picker not available:", e);
    }
  };

  const handleStartConversion = async () => {
    const paths = selectedPaths();
    if (paths.length === 0) return;

    setConverting(true);
    setResults([]);
    try {
      const tasks: ConvertTask[] = paths.map((p) => ({
        source_path: p,
        target_format: targetFormat(),
        quality: quality(),
        output_dir: outputDir().trim() || undefined,
      }));

      const res = await convertImages(tasks);
      setResults(res);
    } catch (e: unknown) {
      alert(`Conversion error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setConverting(false);
    }
  };

  const formatSize = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <ImageIcon class="text-primary" size={20} />
            <span>Batch Image Format Converter</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Convert, compress, and optimize image files in batch (PNG, JPEG, WebP)
          </p>
        </div>

        <button
          onClick={handlePickFiles}
          class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors"
        >
          <FolderOpen size={14} />
          <span>Select Image Files</span>
        </button>
      </div>

      {/* Conversion Options */}
      <div class="p-3 bg-card border border-border rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <label class="block font-medium text-muted-foreground mb-1">Target Format</label>
          <div class="flex space-x-2">
            {(["webp", "png", "jpeg"] as const).map((fmt) => (
              <button
                onClick={() => setTargetFormat(fmt)}
                class={`flex-1 py-1.5 uppercase font-mono rounded text-xs transition-colors ${
                  targetFormat() === fmt
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label class="block font-medium text-muted-foreground mb-1">
            Compression Quality ({quality()}%)
          </label>
          <input
            type="range"
            min="20"
            max="100"
            value={quality()}
            onInput={(e) => setQuality(parseInt(e.currentTarget.value))}
            class="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary mt-2"
          />
        </div>

        <div>
          <label class="block font-medium text-muted-foreground mb-1">
            Output Folder (Optional)
          </label>
          <div class="flex items-center space-x-1.5">
            <input
              type="text"
              value={outputDir()}
              onInput={(e) => setOutputDir(e.currentTarget.value)}
              placeholder="Same as source"
              class="flex-1 px-2.5 py-1.5 bg-background border border-input rounded text-foreground font-mono"
            />
            <button
              onClick={handlePickOutputDir}
              class="p-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              <FolderOpen size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Items & Actions */}
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">
          {selectedPaths().length} files selected
        </span>

        <button
          disabled={selectedPaths().length === 0 || converting()}
          onClick={handleStartConversion}
          class="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-all disabled:opacity-50"
        >
          {converting() ? (
            <>
              <RefreshCw size={14} class="animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Play size={14} class="fill-primary-foreground" />
              <span>Convert All Selected</span>
            </>
          )}
        </button>
      </div>

      {/* File List / Results */}
      <div class="flex-1 overflow-y-auto pr-1">
        <Show
          when={selectedPaths().length > 0}
          fallback={
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-lg">
              <FileImage size={32} class="opacity-40" />
              <p class="text-xs">Click "Select Image Files" to add items to convert.</p>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={selectedPaths()}>
              {(path, idx) => {
                const res = results()[idx()];
                const filename = path.split(/[\\/]/).pop();
                return (
                  <div class="p-2.5 bg-card border border-border rounded-lg flex items-center justify-between text-xs">
                    <div class="flex items-center space-x-2.5 min-w-0">
                      <FileImage size={16} class="text-primary flex-shrink-0" />
                      <div class="min-w-0">
                        <p class="font-medium text-foreground truncate">{filename}</p>
                        <p class="text-[11px] text-muted-foreground font-mono truncate">
                          {path}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center space-x-4 flex-shrink-0">
                      {res ? (
                        <div class="flex items-center space-x-2">
                          {res.success ? (
                            <>
                              <span class="text-[11px] font-mono text-muted-foreground">
                                {formatSize(res.original_size_bytes)} →{" "}
                                <strong class="text-green-500">
                                  {formatSize(res.converted_size_bytes)}
                                </strong>
                              </span>
                              <CheckCircle2 size={16} class="text-green-500" />
                            </>
                          ) : (
                            <>
                              <span class="text-[11px] text-destructive">
                                {res.error_message || "Failed"}
                              </span>
                              <AlertTriangle size={16} class="text-destructive" />
                            </>
                          )}
                        </div>
                      ) : (
                        <span class="text-[11px] text-muted-foreground">Pending</span>
                      )}
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
