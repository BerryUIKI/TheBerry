import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { ConvertResult, ConvertTask, SupportedOutputFormat } from "../types/imageConverter";
import { convertSingleImage, scanImagePaths } from "../services/imageConverter";
import { previewWithQuickLook } from "../services/quicklook";
import { useToast } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";
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
  ChevronDown,
} from "lucide-solid";

export function ImageConverterView() {
  const { success, error, info, warning } = useToast();
  const { t } = useI18n();
  const [fileList, setFileList] = createSignal<string[]>([]);
  const OTHER_FORMATS: { value: SupportedOutputFormat; label: string }[] = [
    { value: "webp", label: "WebP" },
    { value: "jfif", label: "JFIF" },
    { value: "bmp", label: "BMP" },
    { value: "tiff", label: "TIFF" },
    { value: "gif", label: "GIF" },
    { value: "ico", label: "ICO" },
  ];

  // Target format defaults to JPEG (primary options: JPEG and PNG, all others in dropdown)
  const [targetFormat, setTargetFormat] = createSignal<SupportedOutputFormat>("jpeg");
  const isOtherFormat = (fmt: string) => fmt !== "jpeg" && fmt !== "png";
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
      const scanned = await scanImagePaths(paths);
      if (scanned.length === 0) {
        info("No Images Found", "No supported images found in dropped paths");
        return;
      }
      const existing = new Set(fileList());
      const newItems = scanned.filter((p) => !existing.has(p));
      if (newItems.length > 0) {
        setFileList([...fileList(), ...newItems]);
        success("Images Added", `Added ${newItems.length} images to queue`);
      }
    } catch (e) {
      console.warn("Scan image paths failed:", e);
    }
  };

  const handleSelectFiles = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Supported Images",
            extensions: [
              "png",
              "jpg",
              "jpeg",
              "jfif",
              "jpe",
              "jif",
              "webp",
              "gif",
              "bmp",
              "dib",
              "tiff",
              "tif",
              "ico",
              "tga",
              "qoi",
              "heic",
              "heif",
              "avif",
            ],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        const existing = new Set(fileList());
        const newItems = paths.filter((p) => !existing.has(p));
        setFileList([...fileList(), ...newItems]);
        if (newItems.length > 0) {
          success("Images Added", `Added ${newItems.length} image(s) to queue`);
        }
      }
    } catch (e) {
      console.warn("Dialog failed:", e);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        await addScannedPaths([selected]);
      }
    } catch (e) {
      console.warn("Folder dialog failed:", e);
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
    } catch (e) {
      console.warn("Output dir dialog failed:", e);
    }
  };

  const handleClearAll = () => {
    setFileList([]);
    setResults([]);
    setProgressCurrent(0);
    setProgressTotal(0);
    setCurrentFileName("");
  };

  const handleRemoveFile = (pathToRemove: string) => {
    setFileList(fileList().filter((p) => p !== pathToRemove));
    setResults(results().filter((r) => r.source_path !== pathToRemove));
  };

  const applyPreset = (preset: "web" | "mobile" | "lossless" | "thumbnail") => {
    switch (preset) {
      case "web":
        setTargetFormat("webp");
        setQuality(80);
        setEnableResize(false);
        break;
      case "mobile":
        setTargetFormat("jpeg");
        setQuality(85);
        setEnableResize(false);
        break;
      case "lossless":
        setTargetFormat("png");
        setQuality(100);
        setEnableResize(false);
        break;
      case "thumbnail":
        setTargetFormat("webp");
        setQuality(75);
        setEnableResize(true);
        setResizeWidth(600);
        setResizeHeight(undefined);
        setPreserveAspect(true);
        break;
    }
    info("Preset Applied", `Configured for ${preset.toUpperCase()} preset`);
  };

  const handleStopConvert = () => {
    isCancelledRef = true;
    setConverting(false);
    info(t("image_converter.stop"), "Cancellation signal sent");
  };

  const handleConvert = async () => {
    const list = fileList();
    if (list.length === 0) return;

    setConverting(true);
    isCancelledRef = false;
    setProgressTotal(list.length);
    setProgressCurrent(0);
    setResults([]);

    const newResults: ConvertResult[] = [];
    let completedCount = 0;

    const concurrency = Math.min(4, list.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < list.length) {
        if (isCancelledRef) break;

        const idx = currentIndex++;
        if (idx >= list.length) break;

        const filePath = list[idx];
        const filename = filePath.split(/[\\/]/).pop() || filePath;
        setCurrentFileName(filename);

        let effectiveOutputDir: string | undefined = outputDir() ? outputDir() : undefined;
        if (autoCreateSubfolder() && subfolderName().trim()) {
          const base = effectiveOutputDir
            ? effectiveOutputDir
            : filePath.substring(0, Math.max(filePath.lastIndexOf("\\"), filePath.lastIndexOf("/")));
          const cleanSub = subfolderName().trim().replace(/[/\\?%*:|"<>]/g, "");
          effectiveOutputDir = `${base}\\${cleanSub}`;
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

        completedCount++;
        setProgressCurrent(completedCount);
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    setConverting(false);
    setCurrentFileName("");

    if (isCancelledRef) {
      warning(t("image_converter.stop"), `Stopped after processing ${newResults.length} of ${list.length} images`);
    } else {
      const successfulCount = newResults.filter((r) => r.success).length;
      const failedCount = list.length - successfulCount;
      success(t("image_converter.results_summary", { success: String(successfulCount), failed: String(failedCount) }));
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
            <span>{t("image_converter.title")}</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            {t("image_converter.subtitle")}
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <button
            disabled={fileList().length === 0 || converting()}
            onClick={handleClearAll}
            class="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
          >
            {t("image_converter.clear_all")}
          </button>
          <button
            onClick={handleSelectFolder}
            disabled={converting()}
            class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 flex items-center space-x-1.5 transition-all border border-border active:scale-95 shadow-xs disabled:opacity-50"
            title="Scan folder recursively"
          >
            <FolderPlus size={14} />
            <span>{t("image_converter.browse_folder")}</span>
          </button>
          <button
            onClick={handleSelectFiles}
            disabled={converting()}
            class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 flex items-center space-x-1.5 transition-all border border-border active:scale-95 shadow-xs disabled:opacity-50"
          >
            <FolderOpen size={14} />
            <span>{t("image_converter.browse_files")}</span>
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
                <span>{t("image_converter.start_convert", { count: String(fileList().length) })}</span>
              </button>
            }
          >
            <button
              onClick={handleStopConvert}
              class="px-4 py-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 animate-pulse"
              title="Stop ongoing conversion"
            >
              <Square size={12} fill="currentColor" />
              <span>{t("image_converter.stop")} ({progressCurrent()}/{progressTotal()})</span>
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
            <span>Presets:</span>
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
          {/* Format Selection - Primary JPEG & PNG, all other formats in dropdown */}
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-medium text-muted-foreground">{t("image_converter.target_format")}</label>
              <Show when={isOtherFormat(targetFormat())}>
                <span class="text-[10px] uppercase font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {targetFormat()}
                </span>
              </Show>
            </div>
            <div class="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setTargetFormat("jpeg")}
                class={`flex-1 py-1.5 rounded-lg uppercase font-semibold text-xs transition-all active:scale-95 ${
                  targetFormat() === "jpeg"
                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                }`}
              >
                JPEG
              </button>
              <button
                type="button"
                onClick={() => setTargetFormat("png")}
                class={`flex-1 py-1.5 rounded-lg uppercase font-semibold text-xs transition-all active:scale-95 ${
                  targetFormat() === "png"
                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                }`}
              >
                PNG
              </button>
              <div class="relative flex-1">
                <select
                  value={isOtherFormat(targetFormat()) ? targetFormat() : ""}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    if (val) {
                      setTargetFormat(val as SupportedOutputFormat);
                    }
                  }}
                  class={`w-full py-1.5 pl-2 pr-6 rounded-lg text-xs font-semibold uppercase appearance-none cursor-pointer transition-all border outline-none truncate ${
                    isOtherFormat(targetFormat())
                      ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border"
                  }`}
                >
                  <option value="" disabled selected={!isOtherFormat(targetFormat())} class="bg-card text-card-foreground">
                    {isOtherFormat(targetFormat()) ? targetFormat().toUpperCase() : t("image_converter.other_formats")}
                  </option>
                  <For each={OTHER_FORMATS}>
                    {(fmt) => (
                      <option
                        value={fmt.value}
                        selected={targetFormat() === fmt.value}
                        class="bg-card text-card-foreground font-medium"
                      >
                        {fmt.label}
                      </option>
                    )}
                  </For>
                </select>
                <ChevronDown
                  size={12}
                  class={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                    isOtherFormat(targetFormat()) ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Quality Slider */}
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-medium text-muted-foreground">{t("image_converter.quality", { val: String(quality()) })}</label>
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
            <label class="block font-medium text-muted-foreground mb-1">{t("image_converter.output_dir")}</label>
            <div class="flex items-center space-x-1.5">
              <input
                type="text"
                value={outputDir()}
                placeholder={t("image_converter.output_dir_placeholder")}
                readOnly
                class="flex-1 px-2.5 py-1.5 bg-background border border-input rounded-lg text-[11px] text-muted-foreground truncate"
              />
              <button
                onClick={handleSelectOutputDir}
                class="px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs hover:bg-secondary/80 transition-colors border border-border"
              >
                {t("image_converter.choose_output_dir")}
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
              <span>{t("image_converter.auto_subfolder")}</span>
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
              <span>{t("image_converter.enable_resize")}</span>
            </label>
          </div>

          <Show when={enableResize()}>
            <div class="flex items-center space-x-3 w-full sm:w-auto pt-1 sm:pt-0">
              <div class="flex items-center space-x-1">
                <span class="text-muted-foreground text-[11px]">{t("image_converter.width")}:</span>
                <input
                  type="number"
                  placeholder="1920"
                  value={resizeWidth() || ""}
                  onInput={(e) =>
                    setResizeWidth(e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)
                  }
                  class="w-20 px-2 py-0.5 bg-background border border-input rounded-md text-xs text-foreground font-mono"
                />
              </div>

              <div class="flex items-center space-x-1">
                <span class="text-muted-foreground text-[11px]">{t("image_converter.height")}:</span>
                <input
                  type="number"
                  placeholder="1080"
                  value={resizeHeight() || ""}
                  onInput={(e) =>
                    setResizeHeight(e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)
                  }
                  class="w-20 px-2 py-0.5 bg-background border border-input rounded-md text-xs text-foreground font-mono"
                />
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
                  {t("image_converter.keep_aspect")}
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
                  <span>{t("image_converter.converting")} ({progressCurrent()}/{progressTotal()}):</span>
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
              {t("image_converter.results_summary", { success: String(results().filter((r) => r.success).length), failed: String(results().filter((r) => !r.success).length) })}
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
                  {t("image_converter.dropzone_title")}
                </p>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                  {t("image_converter.dropzone_desc")}
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

