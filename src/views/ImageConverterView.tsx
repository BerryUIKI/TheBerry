import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { ConvertResult, ConvertTask } from "../types/imageConverter";
import { convertSingleImage, scanImagePaths } from "../services/imageConverter";
import { previewWithQuickLook } from "../services/quicklook";
import { useToast } from "../context/ToastContext";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  Image,
  FolderOpen,
  FolderPlus,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
  UploadCloud,
  Layers,
  Eye,
  FolderCheck,
} from "lucide-solid";

export function ImageConverterView() {
  const { success, error, info, warning } = useToast();
  const [fileList, setFileList] = createSignal<string[]>([]);
  // Requirement 5: Target format defaults to JPEG
  const [targetFormat, setTargetFormat] = createSignal<"webp" | "jpeg" | "png">("jpeg");
  const [quality, setQuality] = createSignal<number>(85);
  const [outputDir, setOutputDir] = createSignal<string>("");

  // Requirement 4: Option to auto-create subfolder in output directory
  const [autoCreateSubfolder, setAutoCreateSubfolder] = createSignal<boolean>(false);
  const [subfolderName, setSubfolderName] = createSignal<string>("converted");

  // Requirement 1 & 2: Progress tracking & cancellation
  const [converting, setConverting] = createSignal<boolean>(false);
  const [progressCurrent, setProgressCurrent] = createSignal<number>(0);
  const [progressTotal, setProgressTotal] = createSignal<number>(0);
  const [currentFileName, setCurrentFileName] = createSignal<string>("");
  const [results, setResults] = createSignal<ConvertResult[]>([]);
  let isCancelledRef = false;

  // Requirement 3: Drag & Drop state
  const [isDragOver, setIsDragOver] = createSignal<boolean>(false);

  // Resize Controls
  const [enableResize, setEnableResize] = createSignal<boolean>(false);
  const [resizeWidth, setResizeWidth] = createSignal<number | undefined>(undefined);
  const [resizeHeight, setResizeHeight] = createSignal<number | undefined>(undefined);
  const [preserveAspect, setPreserveAspect] = createSignal<boolean>(true);

  // Setup Tauri Drag & Drop listener
  onMount(() => {
    let unlistenDragDrop: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlistenDragDrop = await appWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDragOver(true);
          } else if (event.payload.type === "leave") {
            setIsDragOver(false);
          } else if (event.payload.type === "drop") {
            setIsDragOver(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              await addScannedPaths(paths);
            }
          }
        });
      } catch (e) {
        console.warn("Failed to attach Tauri drag drop listener:", e);
      }
    };

    setupListener();

    onCleanup(() => {
      if (unlistenDragDrop) {
        unlistenDragDrop();
      }
    });
  });

  const addScannedPaths = async (paths: string[]) => {
    try {
      const scanned = await scanImagePaths(paths, true);
      if (scanned && scanned.length > 0) {
        setFileList((prev) => Array.from(new Set([...prev, ...scanned])));
        success("Images Added", `Added ${scanned.length} image file(s) to queue`);
      } else {
        warning("No Images Found", "The dropped file(s) or folder(s) did not contain supported image formats");
      }
    } catch (err) {
      console.warn("Failed to scan paths:", err);
      // Fallback direct addition
      setFileList((prev) => Array.from(new Set([...prev, ...paths])));
    }
  };

  const applyPreset = (preset: "web" | "lossless" | "thumbnail" | "mobile") => {
    switch (preset) {
      case "web":
        setTargetFormat("webp");
        setQuality(80);
        setEnableResize(false);
        info("Preset Applied", "Web Optimizer (WebP @ 80%)");
        break;
      case "lossless":
        setTargetFormat("png");
        setQuality(100);
        setEnableResize(false);
        info("Preset Applied", "Lossless Archival (PNG @ 100%)");
        break;
      case "thumbnail":
        setTargetFormat("webp");
        setQuality(75);
        setEnableResize(true);
        setResizeWidth(600);
        setResizeHeight(undefined);
        setPreserveAspect(true);
        info("Preset Applied", "Thumbnail (WebP @ 600px width)");
        break;
      case "mobile":
        setTargetFormat("jpeg");
        setQuality(85);
        setEnableResize(true);
        setResizeWidth(1280);
        setResizeHeight(undefined);
        setPreserveAspect(true);
        info("Preset Applied", "Mobile Friendly (JPEG @ 1280px width)");
        break;
    }
  };

  const handleSelectFiles = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "heic", "heif", "hif"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        await addScannedPaths(selected);
      }
    } catch (err) {
      console.warn("Picker error:", err);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: true,
      });

      if (selected) {
        const folders = Array.isArray(selected) ? selected : [selected];
        await addScannedPaths(folders);
      }
    } catch (err) {
      console.warn("Folder picker error:", err);
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
        success("Output Directory Set", selected);
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
    setProgressCurrent(0);
    setProgressTotal(0);
    setCurrentFileName("");
  };

  // Requirement 2: Stop / Cancel conversion
  const handleStopConvert = () => {
    if (converting()) {
      isCancelledRef = true;
      warning("Stopping...", "Cancelling image conversion process");
    }
  };

  // Requirement 1 & 2: Incremental conversion with progress bar and cancellation
  const handleConvert = async () => {
    const list = fileList();
    if (list.length === 0 || converting()) return;

    setConverting(true);
    isCancelledRef = false;
    setProgressCurrent(0);
    setProgressTotal(list.length);
    setResults([]);

    const subName = subfolderName().trim() || "converted";
    const customOut = outputDir().trim();

    const newResults: ConvertResult[] = [];

    for (let i = 0; i < list.length; i++) {
      if (isCancelledRef) {
        break;
      }

      const filePath = list[i];
      const fname = filePath.split(/[\\/]/).pop() || filePath;
      setCurrentFileName(fname);
      setProgressCurrent(i + 1);

      // Determine task output dir
      let effectiveOutputDir: string | undefined = undefined;
      if (autoCreateSubfolder()) {
        if (customOut) {
          effectiveOutputDir = `${customOut}/${subName}`;
        } else {
          const parentDir = filePath.substring(0, Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/")));
          effectiveOutputDir = parentDir ? `${parentDir}/${subName}` : subName;
        }
      } else if (customOut) {
        effectiveOutputDir = customOut;
      }

      const task: ConvertTask = {
        source_path: filePath,
        target_format: targetFormat(),
        quality: quality(),
        output_dir: effectiveOutputDir,
        resize_width: enableResize() ? resizeWidth() : undefined,
        resize_height: enableResize() ? resizeHeight() : undefined,
        preserve_aspect_ratio: enableResize() ? preserveAspect() : undefined,
      };

      try {
        const res = await convertSingleImage(task);
        newResults.push(res);
        setResults([...newResults]);
      } catch (err) {
        const failRes: ConvertResult = {
          source_path: filePath,
          target_path: "",
          original_size_bytes: 0,
          converted_size_bytes: 0,
          success: false,
          error_message: String(err),
          width: 0,
          height: 0,
        };
        newResults.push(failRes);
        setResults([...newResults]);
      }
    }

    setConverting(false);
    setCurrentFileName("");

    if (isCancelledRef) {
      warning("Conversion Stopped", `Stopped after processing ${newResults.length} of ${list.length} images`);
    } else {
      const successfulCount = newResults.filter((r) => r.success).length;
      success("Conversion Complete", `Successfully processed ${successfulCount}/${list.length} images`);
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

  const progressPercent = () => {
    if (progressTotal() === 0) return 0;
    return Math.round((progressCurrent() / progressTotal()) * 100);
  };

  return (
    <div
      class={`h-full flex flex-col p-6 space-y-4 overflow-hidden relative transition-colors ${
        isDragOver() ? "bg-primary/5 ring-2 ring-primary ring-inset rounded-lg" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
    >
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Image class="text-primary" size={20} />
            <span>Batch Image Compressor & Converter</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Bulk convert JPEG, PNG, WebP, and Apple HEIC/HEIF images with folder scanning and Lanczos3 quality optimization
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
            onClick={handleSelectFolder}
            disabled={converting()}
            class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 flex items-center space-x-1.5 transition-all border border-border active:scale-95 shadow-xs disabled:opacity-50"
            title="Scan folder recursively for all images"
          >
            <FolderPlus size={14} />
            <span>Add Folder</span>
          </button>
          <button
            onClick={handleSelectFiles}
            disabled={converting()}
            class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 flex items-center space-x-1.5 transition-all border border-border active:scale-95 shadow-xs disabled:opacity-50"
          >
            <FolderOpen size={14} />
            <span>Add Files</span>
          </button>

          {/* Requirement 1 & 2: Start Convert or Stop conversion button */}
          <Show
            when={converting()}
            fallback={
              <button
                disabled={fileList().length === 0}
                onClick={handleConvert}
                class="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50 active:scale-95"
              >
                <Play size={13} />
                <span>Convert ({fileList().length})</span>
              </button>
            }
          >
            <button
              onClick={handleStopConvert}
              class="px-4 py-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 animate-pulse"
              title="Stop ongoing conversion"
            >
              <Square size={12} fill="currentColor" />
              <span>Stop ({progressCurrent()}/{progressTotal()})</span>
            </button>
          </Show>
        </div>
      </div>

      {/* Control Panel */}
      <div class="p-4 bg-card border border-border rounded-xl space-y-3.5 shadow-sm">
        {/* Presets Row */}
        <div class="flex items-center space-x-2 text-xs border-b border-border/50 pb-2.5">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center space-x-1">
            <Layers size={13} class="text-primary" />
            <span>Quick Presets:</span>
          </span>
          <div class="flex items-center space-x-1.5 flex-wrap">
            <button
              onClick={() => applyPreset("mobile")}
              class="px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 text-foreground text-[11px] font-medium transition-colors border border-border/70 active:scale-95"
            >
              Standard JPEG (85%)
            </button>
            <button
              onClick={() => applyPreset("web")}
              class="px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 text-foreground text-[11px] font-medium transition-colors border border-border/70 active:scale-95"
            >
              Web Optimized (WebP 80%)
            </button>
            <button
              onClick={() => applyPreset("lossless")}
              class="px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 text-foreground text-[11px] font-medium transition-colors border border-border/70 active:scale-95"
            >
              Lossless (PNG)
            </button>
            <button
              onClick={() => applyPreset("thumbnail")}
              class="px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 text-foreground text-[11px] font-medium transition-colors border border-border/70 active:scale-95"
            >
              Thumbnail (600px)
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          {/* Format Selection - Default JPEG */}
          <div>
            <label class="block font-medium text-muted-foreground mb-1">Target Format</label>
            <div class="flex items-center space-x-1">
              {(["jpeg", "webp", "png"] as const).map((fmt) => (
                <button
                  onClick={() => setTargetFormat(fmt)}
                  class={`flex-1 py-1.5 rounded-lg uppercase font-semibold text-xs transition-all active:scale-95 ${
                    targetFormat() === fmt
                      ? "bg-primary text-primary-foreground shadow-xs"
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
                class="flex-1 px-2.5 py-1.5 bg-background border border-input rounded-lg text-[11px] text-muted-foreground truncate"
              />
              <button
                onClick={handleSelectOutputDir}
                class="px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs hover:bg-secondary/80 transition-colors border border-border"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Output Subfolder & Resizing Row */}
        <div class="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between text-xs gap-3">
          {/* Requirement 4: Auto-create subfolder option */}
          <div class="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto_subfolder"
              checked={autoCreateSubfolder()}
              onChange={(e) => setAutoCreateSubfolder(e.currentTarget.checked)}
              class="rounded cursor-pointer text-primary focus:ring-primary"
            />
            <label for="auto_subfolder" class="font-medium text-foreground cursor-pointer flex items-center space-x-1">
              <FolderCheck size={13} class="text-primary" />
              <span>Auto-create subfolder in output directory</span>
            </label>
            <Show when={autoCreateSubfolder()}>
              <div class="flex items-center space-x-1 ml-1 animate-in fade-in">
                <span class="text-muted-foreground text-[11px]">/</span>
                <input
                  type="text"
                  value={subfolderName()}
                  onInput={(e) => setSubfolderName(e.currentTarget.value)}
                  placeholder="converted"
                  class="w-28 px-2 py-0.5 bg-background border border-input rounded-md text-xs text-foreground font-mono"
                />
              </div>
            </Show>
          </div>

          {/* Resizing Accordion */}
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
              <span>Enable Resizing</span>
            </label>
          </div>

          <Show when={enableResize()}>
            <div class="flex items-center space-x-3 w-full sm:w-auto pt-1 sm:pt-0">
              <div class="flex items-center space-x-1">
                <span class="text-muted-foreground text-[11px]">Width:</span>
                <input
                  type="number"
                  placeholder="e.g. 1920"
                  value={resizeWidth() || ""}
                  onInput={(e) =>
                    setResizeWidth(e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)
                  }
                  class="w-20 px-2 py-0.5 bg-background border border-input rounded-md text-xs text-foreground font-mono"
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
                  class="w-20 px-2 py-0.5 bg-background border border-input rounded-md text-xs text-foreground font-mono"
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
                  Lock Aspect
                </label>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Requirement 1: Dedicated Animated Progress Bar */}
      <Show when={converting() || (progressTotal() > 0 && progressCurrent() > 0)}>
        <div class="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-sm animate-in fade-in">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center space-x-2 font-medium truncate flex-1 mr-2">
              <Show
                when={converting()}
                fallback={
                  <span class="flex items-center space-x-1.5 text-foreground font-semibold">
                    <CheckCircle2 size={14} class="text-emerald-500" />
                    <span>Processed {results().filter((r) => r.success).length} of {progressTotal()} items</span>
                  </span>
                }
              >
                <span class="flex items-center space-x-1.5 text-primary font-semibold">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span>Converting ({progressCurrent()}/{progressTotal()}):</span>
                </span>
                <span class="text-muted-foreground font-mono truncate text-[11px]">{currentFileName()}</span>
              </Show>
            </div>
            <span class="font-mono font-bold text-primary text-xs flex-shrink-0">{progressPercent()}%</span>
          </div>

          {/* Progress track */}
          <div class="w-full bg-secondary/80 rounded-full h-2 overflow-hidden border border-border/50">
            <div
              class={`h-full transition-all duration-200 ease-out rounded-full ${
                converting() ? "bg-primary" : "bg-emerald-500"
              }`}
              style={{ width: `${progressPercent()}%` }}
            />
          </div>
        </div>
      </Show>

      {/* Summary Banner if results exist */}
      <Show when={!converting() && results().length > 0}>
        <div class="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs shadow-sm animate-in fade-in">
          <div class="flex items-center space-x-2">
            <Sparkles size={16} class="text-emerald-500" />
            <span class="font-medium text-foreground">
              Total converted: {results().filter((r) => r.success).length} of {results().length} images
            </span>
          </div>

          <div class="flex items-center space-x-3 font-mono">
            <span class="text-muted-foreground">
              {formatBytes(totalOriginalBytes())} → {formatBytes(totalConvertedBytes())}
            </span>
            <Show when={totalSavingsPercent() > 0}>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">
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
              class={`h-56 flex flex-col items-center justify-center space-y-3 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                isDragOver()
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border hover:border-primary/50 bg-card/40 hover:bg-card/70"
              }`}
            >
              <UploadCloud size={38} class={`transition-transform duration-200 ${isDragOver() ? "text-primary scale-110" : "text-muted-foreground/60"}`} />
              <div class="text-center">
                <p class="text-xs font-semibold text-foreground">
                  Drag and drop image files or folders here, or click to browse
                </p>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                  Supports dropping folders (recursive scan) and converting JPEG, PNG, WebP, and Apple HEIC/HEIF files
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
                  <div
                    onDblClick={() => previewWithQuickLook(path)}
                    class="p-3.5 bg-card border border-border rounded-xl flex items-center justify-between text-xs shadow-xs hover:border-primary/30 transition-all group cursor-pointer"
                  >
                    <div
                      onClick={() => previewWithQuickLook(path)}
                      class="flex items-center space-x-3 min-w-0 flex-1"
                    >
                      <Image size={16} class="text-primary flex-shrink-0" />
                      <div class="min-w-0">
                        <p class="font-medium text-foreground truncate">{filename}</p>
                        <p class="text-[10px] text-muted-foreground font-mono truncate">{path}</p>
                      </div>
                    </div>

                    <div class="flex items-center space-x-3 flex-shrink-0 ml-3">
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
                              <span class="flex items-center space-x-1 text-emerald-500 font-semibold text-[11px]">
                                <CheckCircle2 size={13} />
                                <span>Done</span>
                              </span>
                            </Show>
                          </div>
                        )}
                      </Show>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          previewWithQuickLook(path);
                        }}
                        title="Preview Image (Space / Click)"
                        class="p-1 text-muted-foreground hover:text-primary rounded-md hover:bg-secondary transition-colors"
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        disabled={converting()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(path);
                        }}
                        title="Remove from list"
                        class="p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-secondary transition-colors disabled:opacity-30"
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

