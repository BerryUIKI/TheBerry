import { createSignal, For, Show } from "solid-js";
import { ConvertResult, ConvertTask } from "../types/imageConverter";
import { convertImages } from "../services/imageConverter";
import {
  Image,
  FolderOpen,
  Play,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
  Maximize2,
  UploadCloud,
} from "lucide-solid";

export function ImageConverterView() {
  const [fileList, setFileList] = createSignal<string[]>([]);
  const [targetFormat, setTargetFormat] = createSignal<"webp" | "jpeg" | "png">("webp");
  const [quality, setQuality] = createSignal<number>(85);
  const [outputDir, setOutputDir] = createSignal<string>("");
  const [converting, setConverting] = createSignal<boolean>(false);
  const [results, setResults] = createSignal<ConvertResult[]>([]);
  const [isDragOver, setIsDragOver] = createSignal<boolean>(false);

  // Resize Controls
  const [enableResize, setEnableResize] = createSignal<boolean>(false);
  const [resizeWidth, setResizeWidth] = createSignal<number | undefined>(undefined);
  const [resizeHeight, setResizeHeight] = createSignal<number | undefined>(undefined);
  const [preserveAspect, setPreserveAspect] = createSignal<boolean>(true);

  const handleSelectFiles = async () => {
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
        setFileList((prev) => Array.from(new Set([...prev, ...selected])));
      }
    } catch (err) {
      console.warn("Picker error:", err);
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch (err) {
      console.warn("Folder picker error:", err);
    }
  };

  const handleRemoveFile = (path: string) => {
    setFileList((prev) => prev.filter((p) => p !== path));
  };

  const handleClearAll = () => {
    setFileList([]);
    setResults([]);
  };

  const handleConvert = async () => {
    if (fileList().length === 0) return;
    setConverting(true);
    setResults([]);

    const tasks: ConvertTask[] = fileList().map((path) => ({
      source_path: path,
      target_format: targetFormat(),
      quality: quality(),
      output_dir: outputDir() || undefined,
      resize_width: enableResize() ? resizeWidth() : undefined,
      resize_height: enableResize() ? resizeHeight() : undefined,
      preserve_aspect_ratio: enableResize() ? preserveAspect() : undefined,
    }));

    try {
      const res = await convertImages(tasks);
      setResults(res);
    } catch (err) {
      console.error("Batch conversion failed:", err);
    } finally {
      setConverting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const totalOriginalBytes = () => results().reduce((acc, r) => acc + r.original_size_bytes, 0);
  const totalConvertedBytes = () => results().reduce((acc, r) => acc + r.converted_size_bytes, 0);
  const totalSavingsPercent = () => {
    const orig = totalOriginalBytes();
    const conv = totalConvertedBytes();
    if (orig === 0 || conv === 0) return 0;
    return Math.round(((orig - conv) / orig) * 100);
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Image class="text-primary" size={20} />
            <span>Batch Image Compressor & Converter</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Bulk convert PNG, JPG, and WebP images with resizing and quality optimization
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <button
            disabled={fileList().length === 0 || converting()}
            onClick={handleClearAll}
            class="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
          >
            Clear List
          </button>
          <button
            onClick={handleSelectFiles}
            class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 flex items-center space-x-1.5 transition-colors border border-border"
          >
            <FolderOpen size={14} />
            <span>Add Files</span>
          </button>
          <button
            disabled={fileList().length === 0 || converting()}
            onClick={handleConvert}
            class="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            <Play size={13} />
            <span>{converting() ? "Converting..." : `Convert (${fileList().length})`}</span>
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div class="p-3.5 bg-card border border-border rounded-lg space-y-3 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Format Selection */}
          <div>
            <label class="block font-medium text-muted-foreground mb-1">Target Format</label>
            <div class="flex items-center space-x-1">
              {(["webp", "jpeg", "png"] as const).map((fmt) => (
                <button
                  onClick={() => setTargetFormat(fmt)}
                  class={`flex-1 py-1.5 rounded uppercase font-semibold text-xs transition-colors ${
                    targetFormat() === fmt
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider */}
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-medium text-muted-foreground">Quality</label>
              <span class="font-mono text-xs font-semibold text-primary">{quality()}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={quality()}
              onInput={(e) => setQuality(parseInt(e.currentTarget.value))}
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Destination Folder */}
          <div>
            <label class="block font-medium text-muted-foreground mb-1">Output Folder</label>
            <div class="flex items-center space-x-1.5">
              <input
                type="text"
                value={outputDir()}
                placeholder="Same folder as original"
                readOnly
                class="flex-1 px-2.5 py-1 bg-background border border-input rounded text-[11px] text-muted-foreground truncate"
              />
              <button
                onClick={handleSelectOutputDir}
                class="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/80"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Resizing Accordion / Settings */}
        <div class="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between text-xs gap-2">
          <div class="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enable_resize"
              checked={enableResize()}
              onChange={(e) => setEnableResize(e.currentTarget.checked)}
              class="rounded cursor-pointer"
            />
            <label for="enable_resize" class="font-medium text-foreground cursor-pointer flex items-center space-x-1">
              <Sliders size={13} class="text-primary" />
              <span>Enable Image Resizing & Scaling</span>
            </label>
          </div>

          <Show when={enableResize()}>
            <div class="flex items-center space-x-3">
              <div class="flex items-center space-x-1">
                <span class="text-muted-foreground text-[11px]">Width:</span>
                <input
                  type="number"
                  placeholder="e.g. 1920"
                  value={resizeWidth() || ""}
                  onInput={(e) =>
                    setResizeWidth(e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)
                  }
                  class="w-20 px-2 py-0.5 bg-background border border-input rounded text-xs text-foreground font-mono"
                />
                <span class="text-muted-foreground text-[10px]">px</span>
              </div>

              <div class="flex items-center space-x-1">
                <span class="text-muted-foreground text-[11px]">Height:</span>
                <input
                  type="number"
                  placeholder="e.g. 1080"
                  value={resizeHeight() || ""}
                  onInput={(e) =>
                    setResizeHeight(e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)
                  }
                  class="w-20 px-2 py-0.5 bg-background border border-input rounded text-xs text-foreground font-mono"
                />
                <span class="text-muted-foreground text-[10px]">px</span>
              </div>

              <div class="flex items-center space-x-1">
                <input
                  type="checkbox"
                  id="lock_aspect"
                  checked={preserveAspect()}
                  onChange={(e) => setPreserveAspect(e.currentTarget.checked)}
                  class="rounded cursor-pointer"
                />
                <label for="lock_aspect" class="text-[11px] text-muted-foreground cursor-pointer">
                  Lock Aspect Ratio
                </label>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Summary Banner if results exist */}
      <Show when={results().length > 0}>
        <div class="p-3 bg-card border border-border rounded-lg flex items-center justify-between text-xs shadow-sm">
          <div class="flex items-center space-x-2">
            <Sparkles size={16} class="text-green-500" />
            <span class="font-medium text-foreground">
              Processed {results().filter((r) => r.success).length} of {results().length} images
            </span>
          </div>

          <div class="flex items-center space-x-3 font-mono">
            <span class="text-muted-foreground">{formatBytes(totalOriginalBytes())} → {formatBytes(totalConvertedBytes())}</span>
            <Show when={totalSavingsPercent() > 0}>
              <span class="px-2 py-0.5 rounded bg-green-500/10 text-green-500 font-bold">
                -{totalSavingsPercent()}% Saved
              </span>
            </Show>
          </div>
        </div>
      </Show>

      {/* File List & Drag Target */}
      <div class="flex-1 overflow-y-auto pr-1">
        <Show
          when={fileList().length > 0}
          fallback={
            <div
              onClick={handleSelectFiles}
              class={`h-56 flex flex-col items-center justify-center space-y-3 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                isDragOver()
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-card/40"
              }`}
            >
              <UploadCloud size={36} class="text-muted-foreground/60" />
              <div class="text-center">
                <p class="text-xs font-semibold text-foreground">
                  Click to select images or drag and drop files here
                </p>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                  Supports batch converting PNG, JPG, JPEG, and WebP files
                </p>
              </div>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={fileList()}>
              {(path) => {
                const res = () => results().find((r) => r.source_path === path);
                const filename = path.split(/[\\/]/).pop();

                return (
                  <div class="p-3 bg-card border border-border rounded-lg flex items-center justify-between text-xs shadow-sm group">
                    <div class="flex items-center space-x-3 min-w-0">
                      <Image size={16} class="text-primary flex-shrink-0" />
                      <div class="min-w-0">
                        <p class="font-medium text-foreground truncate">{filename}</p>
                        <p class="text-[10px] text-muted-foreground font-mono truncate">{path}</p>
                      </div>
                    </div>

                    <div class="flex items-center space-x-3 flex-shrink-0">
                      <Show when={res()}>
                        {(result) => (
                          <div class="flex items-center space-x-2">
                            <Show
                              when={result().success}
                              fallback={
                                <span class="flex items-center space-x-1 text-destructive text-[11px]">
                                  <AlertCircle size={13} />
                                  <span>{result().error_message || "Error"}</span>
                                </span>
                              }
                            >
                              <span class="text-[11px] font-mono text-muted-foreground">
                                {result().width}x{result().height} px • {formatBytes(result().converted_size_bytes)}
                              </span>
                              <span class="flex items-center space-x-1 text-green-500 font-semibold text-[11px]">
                                <CheckCircle2 size={13} />
                                <span>Done</span>
                              </span>
                            </Show>
                          </div>
                        )}
                      </Show>

                      <button
                        onClick={() => handleRemoveFile(path)}
                        class="p-1 text-muted-foreground hover:text-destructive rounded"
                      >
                        <Trash2 size={14} />
                      </button>
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
