import { createSignal, For, Show } from "solid-js";
import {
  X,
  FileOutput,
  FolderOpen,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  Layers,
  RefreshCw,
} from "lucide-solid";
import { open, save } from "@tauri-apps/plugin-dialog";
import * as pdfjsLib from "pdfjs-dist";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PdfToImagesModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError, info } = useToast();

  const [pdfPath, setPdfPath] = createSignal("");
  const [pdfName, setPdfName] = createSignal("");
  const [totalPages, setTotalPages] = createSignal(0);
  const [selectedPages, setSelectedPages] = createSignal<Set<number>>(new Set());
  const [format, setFormat] = createSignal<"png" | "jpeg" | "webp">("png");
  const [scale, setScale] = createSignal<number>(2); // 2x default for crisp quality
  const [loading, setLoading] = createSignal(false);
  const [exporting, setExporting] = createSignal(false);
  const [progressText, setProgressText] = createSignal("");

  let pdfDocInstance: any = null;

  const handleSelectPdf = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "PDF Document",
            extensions: ["pdf"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setLoading(true);
        setPdfPath(selected);
        const name = selected.split(/[/\\]/).pop() || "document.pdf";
        setPdfName(name);

        const res = await fetch(`http://asset.localhost/${selected.replace(/\\/g, "/")}`);
        const buf = await res.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
        pdfDocInstance = await loadingTask.promise;
        const count = pdfDocInstance.numPages;
        setTotalPages(count);

        // Select all pages by default
        const allSet = new Set<number>();
        for (let i = 1; i <= count; i++) allSet.add(i);
        setSelectedPages(allSet);

        success(
          language() === "zh" ? "PDF 载入成功" : "PDF Loaded",
          language() === "zh" ? `共 ${count} 页` : `${count} pages in total`
        );
      }
    } catch (e) {
      toastError(language() === "zh" ? "打开 PDF 失败" : "Failed to open PDF", String(e));
    } finally {
      setLoading(false);
    }
  };

  const togglePage = (p: number) => {
    const next = new Set(selectedPages());
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setSelectedPages(next);
  };

  const toggleSelectAll = () => {
    if (selectedPages().size === totalPages()) {
      setSelectedPages(new Set());
    } else {
      const all = new Set<number>();
      for (let i = 1; i <= totalPages(); i++) all.add(i);
      setSelectedPages(all);
    }
  };

  const handleExportImages = async () => {
    if (!pdfDocInstance || selectedPages().size === 0) return;

    setExporting(true);
    try {
      const pagesToExport = Array.from(selectedPages()).sort((a, b) => a - b);
      const mime = format() === "png" ? "image/png" : format() === "jpeg" ? "image/jpeg" : "image/webp";
      const ext = format();

      for (let i = 0; i < pagesToExport.length; i++) {
        const pageNum = pagesToExport[i];
        setProgressText(`${language() === "zh" ? "正在渲染第" : "Rendering page"} ${pageNum} (${i + 1}/${pagesToExport.length})...`);

        const page = await pdfDocInstance.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale() });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;

          const baseName = pdfName().replace(/\.pdf$/i, "");
          const outName = `${baseName}_page_${pageNum}.${ext}`;

          const dataUrl = canvas.toDataURL(mime, 0.95);
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = outName;
          a.click();
        }
      }

      success(
        language() === "zh" ? "导出完成" : "Export Complete",
        language() === "zh"
          ? `已成功导出 ${pagesToExport.length} 张高清图片`
          : `Successfully exported ${pagesToExport.length} image(s)`
      );
    } catch (e) {
      toastError(language() === "zh" ? "导出异常" : "Export Error", String(e));
    } finally {
      setExporting(false);
      setProgressText("");
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
                <FileOutput size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "PDF 转高清图片" : "PDF to Images Converter"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "将 PDF 页面批量渲染导出为 PNG、JPG 或 WebP 高清图像"
                    : "Export PDF pages into high-resolution PNG, JPG, or WebP images"}
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

          {/* Options & Action Bar */}
          <div class="px-6 py-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <button
                onClick={handleSelectPdf}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-xs"
              >
                <FolderOpen size={13} />
                <span>{language() === "zh" ? "选择 PDF 文件..." : "Open PDF..."}</span>
              </button>

              <Show when={pdfName()}>
                <span class="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                  {pdfName()} ({totalPages()} {language() === "zh" ? "页" : "pages"})
                </span>
              </Show>
            </div>

            <div class="flex items-center gap-4 text-xs">
              {/* Format selection */}
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground font-medium">{language() === "zh" ? "格式:" : "Format:"}</span>
                <div class="inline-flex p-0.5 bg-secondary/60 rounded-lg border border-border">
                  {(["png", "jpeg", "webp"] as const).map((fmt) => (
                    <button
                      onClick={() => setFormat(fmt)}
                      class={`px-2 py-0.5 rounded-md text-xs transition-all ${
                        format() === fmt
                          ? "bg-background text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scale / DPI */}
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground font-medium">{language() === "zh" ? "清晰度:" : "Scale:"}</span>
                <select
                  value={scale()}
                  onChange={(e) => setScale(Number(e.currentTarget.value))}
                  class="px-2 py-1 rounded-lg border border-border bg-background text-foreground text-xs outline-none"
                >
                  <option value="1">1x (72 DPI - Draft)</option>
                  <option value="2">2x (144 DPI - HD)</option>
                  <option value="3">3x (216 DPI - Ultra HD)</option>
                </select>
              </div>

              <button
                onClick={handleExportImages}
                disabled={exporting() || selectedPages().size === 0}
                class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
              >
                <Show when={exporting()} fallback={<Download size={13} />}>
                  <RefreshCw size={13} class="animate-spin" />
                </Show>
                <span>{exporting() ? progressText() || (language() === "zh" ? "导出中..." : "Exporting...") : (language() === "zh" ? "导出所选图片" : "Export Images")}</span>
              </button>
            </div>
          </div>

          {/* Pages Grid Preview */}
          <div class="flex-1 overflow-auto p-5 bg-muted/10 min-h-[350px]">
            <Show
              when={totalPages() > 0}
              fallback={
                <div class="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
                  <FileOutput size={42} class="opacity-20 mb-3" />
                  <p class="text-xs">
                    {language() === "zh"
                      ? "未打开 PDF 文件。点击上方「选择 PDF 文件」开始导出图片。"
                      : "No PDF opened. Click 'Open PDF...' above to select a file."}
                  </p>
                </div>
              }
            >
              <div class="space-y-4">
                <div class="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {language() === "zh" ? "已选中" : "Selected"} {selectedPages().size} / {totalPages()}{" "}
                    {language() === "zh" ? "页" : "pages"}
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    class="text-primary hover:underline font-medium"
                  >
                    {selectedPages().size === totalPages()
                      ? language() === "zh" ? "取消全选" : "Deselect All"
                      : language() === "zh" ? "全选页面" : "Select All"}
                  </button>
                </div>

                <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  <For each={Array.from({ length: totalPages() }, (_, i) => i + 1)}>
                    {(p) => {
                      const isSelected = () => selectedPages().has(p);
                      return (
                        <button
                          onClick={() => togglePage(p)}
                          class={`aspect-[3/4] rounded-xl border flex flex-col items-center justify-center gap-1.5 p-2 transition-all ${
                            isSelected()
                              ? "bg-primary/10 border-primary text-primary font-bold shadow-xs ring-1 ring-primary"
                              : "bg-background border-border text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          <span class="text-xs font-mono">{p}</span>
                          <Show when={isSelected()}>
                            <CheckCircle2 size={14} class="text-primary" />
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
