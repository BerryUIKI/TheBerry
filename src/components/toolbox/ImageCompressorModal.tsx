import { createSignal, For, Show } from "solid-js";
import {
  X,
  Image as ImageIcon,
  FolderOpen,
  Play,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Sliders,
  Sparkles,
  ArrowDown,
  RefreshCw,
} from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { compressImages, CompressResult, CompressTask } from "../../services/toolbox";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedFile {
  path: string;
  name: string;
  size: number;
}

export function ImageCompressorModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError, info } = useToast();

  const [files, setFiles] = createSignal<SelectedFile[]>([]);
  const [quality, setQuality] = createSignal(75);
  const [targetFormat, setTargetFormat] = createSignal<"original" | "webp" | "jpeg" | "png">("original");
  const [maxDimension, setMaxDimension] = createSignal<number | null>(null);
  const [outputDir, setOutputDir] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);
  const [results, setResults] = createSignal<CompressResult[]>([]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        const newFiles: SelectedFile[] = selected.map((p) => {
          const name = p.split(/[/\\]/).pop() || p;
          return { path: p, name, size: 0 };
        });

        // De-duplicate
        const existing = new Set(files().map((f) => f.path));
        const merged = [...files(), ...newFiles.filter((f) => !existing.has(f.path))];
        setFiles(merged);
        setResults([]);
      }
    } catch (e) {
      toastError(language() === "zh" ? "选择图片失败" : "Failed to select images", String(e));
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch (e) {
      toastError(language() === "zh" ? "选择输出目录失败" : "Failed to select output folder", String(e));
    }
  };

  const handleCompress = async () => {
    const list = files();
    if (list.length === 0) return;

    setLoading(true);
    setResults([]);

    try {
      const tasks: CompressTask[] = list.map((f) => ({
        source_path: f.path,
        quality: quality(),
        max_width: maxDimension(),
        max_height: maxDimension(),
        output_dir: outputDir() || null,
        output_format: targetFormat(),
      }));

      const resList = await compressImages(tasks);
      setResults(resList);

      const totalSaved = resList.reduce((acc, r) => acc + (r.original_size > r.compressed_size ? r.original_size - r.compressed_size : 0), 0);
      success(
        language() === "zh" ? "压缩完成" : "Compression complete",
        language() === "zh"
          ? `成功压缩 ${resList.filter((r) => r.success).length} 张图片，共节省 ${formatBytes(totalSaved)}`
          : `Processed ${resList.filter((r) => r.success).length} images, saved ${formatBytes(totalSaved)} in total`
      );
    } catch (e) {
      toastError(language() === "zh" ? "压缩过程中出现异常" : "Error during compression", String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-foreground">
          {/* Header */}
          <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <ImageIcon size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "图片深度压缩" : "Image Compressor"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "基于 SIMD 与高质量量化引擎，大幅缩减 PNG、JPG 与 WebP 体积"
                    : "Intelligent lossless & lossy image optimizer powered by SIMD and multi-core engine"}
                </p>
              </div>
            </div>

            <button
              onClick={props.onClose}
              class="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Compression Configuration Bar */}
          <div class="px-6 py-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-4">
            {/* Quality Slider */}
            <div class="flex items-center gap-3 min-w-[200px]">
              <span class="text-xs font-medium text-foreground whitespace-nowrap">
                {language() === "zh" ? "压缩质量:" : "Quality:"}
              </span>
              <input
                type="range"
                min="10"
                max="100"
                value={quality()}
                onInput={(e) => setQuality(Number(e.currentTarget.value))}
                class="w-28 accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
              />
              <span class="text-xs font-mono font-bold text-primary w-10 text-right">{quality()}%</span>
            </div>

            {/* Target Format */}
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-muted-foreground">
                {language() === "zh" ? "格式:" : "Format:"}
              </span>
              <div class="inline-flex p-0.5 bg-secondary/60 rounded-lg border border-border text-xs font-medium">
                {(["original", "webp", "jpeg", "png"] as const).map((fmt) => (
                  <button
                    onClick={() => setTargetFormat(fmt)}
                    class={`px-2.5 py-1 rounded-md transition-all ${
                      targetFormat() === fmt
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {fmt === "original" ? (language() === "zh" ? "保持原样" : "Auto") : fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Resolution */}
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-muted-foreground">
                {language() === "zh" ? "最大尺寸:" : "Max Size:"}
              </span>
              <select
                value={maxDimension() || "none"}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setMaxDimension(val === "none" ? null : Number(val));
                }}
                class="px-2.5 py-1 text-xs rounded-lg border border-border bg-background text-foreground outline-none"
              >
                <option value="none">{language() === "zh" ? "不缩放原图" : "Original Dimensions"}</option>
                <option value="1920">1920 px (Full HD)</option>
                <option value="2560">2560 px (2K QHD)</option>
                <option value="3840">3840 px (4K UHD)</option>
              </select>
            </div>
          </div>

          {/* Action Bar */}
          <div class="px-6 py-2.5 border-b border-border bg-background flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <button
                onClick={handleSelectFiles}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-all shadow-xs border border-border"
              >
                <FolderOpen size={13} />
                <span>{language() === "zh" ? "添加图片..." : "Add Images..."}</span>
              </button>

              <button
                onClick={handleSelectOutputDir}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium transition-all border border-border/60"
                title={outputDir() || (language() === "zh" ? "默认输出到原文件所在目录" : "Default: same folder as original")}
              >
                <FolderOpen size={13} />
                <span class="truncate max-w-[200px]">
                  {outputDir()
                    ? (language() === "zh" ? "已选目录: " : "Dir: ") + outputDir().split(/[/\\]/).pop()
                    : (language() === "zh" ? "指定输出目录" : "Output Folder")}
                </span>
              </button>

              <Show when={files().length > 0}>
                <button
                  onClick={() => {
                    setFiles([]);
                    setResults([]);
                  }}
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 size={13} />
                  <span>{language() === "zh" ? "清空列表" : "Clear"}</span>
                </button>
              </Show>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-muted-foreground font-mono text-[11px]">
                {files().length} {language() === "zh" ? "个待处理文件" : "files"}
              </span>

              <button
                onClick={handleCompress}
                disabled={loading() || files().length === 0}
                class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
              >
                <Show when={loading()} fallback={<Play size={13} />}>
                  <RefreshCw size={13} class="animate-spin" />
                </Show>
                <span>{loading() ? (language() === "zh" ? "正在压缩..." : "Compressing...") : (language() === "zh" ? "开始压缩" : "Start Compress")}</span>
              </button>
            </div>
          </div>

          {/* Files List / Results View */}
          <div class="flex-1 overflow-auto p-4 space-y-2 bg-muted/10 min-h-[350px]">
            <Show
              when={files().length > 0}
              fallback={
                <div class="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
                  <ImageIcon size={42} class="opacity-20 mb-3" />
                  <p class="text-xs">
                    {language() === "zh"
                      ? "暂未添加图片。点击上方「添加图片」或直接拖入文件开始压缩。"
                      : "No images added. Click 'Add Images' above to get started."}
                  </p>
                </div>
              }
            >
              <For each={files()}>
                {(file, idx) => {
                  const result = () => results()[idx()];
                  return (
                    <div class="p-3 bg-background border border-border rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-border/80 transition-colors">
                      <div class="flex items-center gap-3 truncate">
                        <div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 text-muted-foreground">
                          <ImageIcon size={16} />
                        </div>
                        <div class="truncate">
                          <p class="text-xs font-semibold text-foreground truncate">{file.name}</p>
                          <p class="text-[10px] text-muted-foreground font-mono truncate">{file.path}</p>
                        </div>
                      </div>

                      {/* Result Badge */}
                      <div class="flex items-center gap-3 flex-shrink-0">
                        <Show when={result()}>
                          {(res) => (
                            <div class="flex items-center gap-2.5 text-xs font-mono">
                              <Show
                                when={res().success}
                                fallback={
                                  <span class="text-destructive text-[11px] flex items-center gap-1">
                                    <AlertTriangle size={13} />
                                    {res().error_message || (language() === "zh" ? "失败" : "Failed")}
                                  </span>
                                }
                              >
                                <span class="text-muted-foreground text-[11px]">
                                  {formatBytes(res().original_size)} ➔ {formatBytes(res().compressed_size)}
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-600 border border-green-500/20">
                                  -{res().saved_percentage}%
                                </span>
                                <CheckCircle2 size={14} class="text-green-500" />
                              </Show>
                            </div>
                          )}
                        </Show>

                        <button
                          onClick={() => {
                            setFiles((prev) => prev.filter((_, i) => i !== idx()));
                            setResults((prev) => prev.filter((_, i) => i !== idx()));
                          }}
                          class="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
