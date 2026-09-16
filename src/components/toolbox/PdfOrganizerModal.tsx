import { createSignal, For, Show } from "solid-js";
import {
  X,
  Archive,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Scissors,
  Download,
  FileText,
  CheckCircle2,
  RefreshCw,
} from "lucide-solid";
import { open, save } from "@tauri-apps/plugin-dialog";
import { PDFDocument } from "pdf-lib";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface PdfItem {
  id: string;
  path: string;
  name: string;
  pageCount: number;
  pageRange: string; // e.g. "all" or "1-5, 8"
  bytes?: Uint8Array;
}

export function PdfOrganizerModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError, info } = useToast();

  const [activeTab, setActiveTab] = createSignal<"merge" | "split">("merge");
  const [mergeItems, setMergeItems] = createSignal<PdfItem[]>([]);
  const [splitFile, setSplitFile] = createSignal<PdfItem | null>(null);
  const [splitRanges, setSplitRanges] = createSignal("1-2");
  const [splitMode, setSplitMode] = createSignal<"range" | "single_pages">("range");
  const [processing, setProcessing] = createSignal(false);

  const readFileBytes = async (filePath: string): Promise<Uint8Array> => {
    // Read using Tauri asset protocol or binary invoke
    const res = await fetch(`http://asset.localhost/${filePath.replace(/\\/g, "/")}`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  };

  const handleAddMergeFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "PDF Documents",
            extensions: ["pdf"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        for (const filePath of selected) {
          try {
            const bytes = await readFileBytes(filePath);
            const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();
            const name = filePath.split(/[/\\]/).pop() || "document.pdf";

            setMergeItems((prev) => [
              ...prev,
              {
                id: "pdf_" + Math.random().toString(36).substring(2, 9),
                path: filePath,
                name,
                pageCount,
                pageRange: `1-${pageCount}`,
                bytes,
              },
            ]);
          } catch (err) {
            console.error("Failed to load PDF:", filePath, err);
          }
        }
      }
    } catch (e) {
      toastError(language() === "zh" ? "添加 PDF 失败" : "Failed to add PDF", String(e));
    }
  };

  const handleSelectSplitFile = async () => {
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
        const bytes = await readFileBytes(selected);
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        const name = selected.split(/[/\\]/).pop() || "document.pdf";

        setSplitFile({
          id: "split_src",
          path: selected,
          name,
          pageCount: count,
          pageRange: `1-${count}`,
          bytes,
        });

        setSplitRanges(`1-${Math.min(count, 3)}`);
      }
    } catch (e) {
      toastError(language() === "zh" ? "打开 PDF 失败" : "Failed to open PDF", String(e));
    }
  };

  const parsePageIndices = (rangeStr: string, totalPages: number): number[] => {
    const indices: number[] = [];
    const parts = rangeStr.split(",").map((s) => s.trim());

    for (const part of parts) {
      if (!part) continue;
      if (part.toLowerCase() === "all") {
        return Array.from({ length: totalPages }, (_, i) => i);
      }
      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-").map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, Math.min(start, totalPages));
          const e = Math.max(1, Math.min(end, totalPages));
          for (let i = s; i <= e; i++) {
            indices.push(i - 1);
          }
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          indices.push(p - 1);
        }
      }
    }
    return Array.from(new Set(indices)).sort((a, b) => a - b);
  };

  const handleExecuteMerge = async () => {
    const items = mergeItems();
    if (items.length === 0) return;

    setProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of items) {
        const bytes = item.bytes || (await readFileBytes(item.path));
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const total = srcDoc.getPageCount();
        const pageIndices = parsePageIndices(item.pageRange, total);

        const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();

      const savePath = await save({
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        defaultPath: "merged_document.pdf",
      });

      if (savePath) {
        const blob = new Blob([mergedBytes], { type: "application/pdf" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = savePath.split(/[/\\]/).pop() || "merged_document.pdf";
        a.click();
        URL.revokeObjectURL(a.href);
        success(
          language() === "zh" ? "合并成功" : "Merge Successful",
          language() === "zh" ? `已保存至: ${savePath}` : `Saved to: ${savePath}`
        );
      }
    } catch (e) {
      toastError(language() === "zh" ? "合并失败" : "Merge Failed", String(e));
    } finally {
      setProcessing(false);
    }
  };

  const handleExecuteSplit = async () => {
    const file = splitFile();
    if (!file || !file.bytes) return;

    setProcessing(true);
    try {
      const srcDoc = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      const total = srcDoc.getPageCount();
      const indices = parsePageIndices(splitRanges(), total);

      if (indices.length === 0) {
        toastError(
          language() === "zh" ? "页码范围无效" : "Invalid Page Range",
          language() === "zh" ? "未解析到有效页码" : "No valid pages specified"
        );
        setProcessing(false);
        return;
      }

      const splitDoc = await PDFDocument.create();
      const copiedPages = await splitDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((page) => splitDoc.addPage(page));

      const splitBytes = await splitDoc.save();

      const defaultName = `${file.name.replace(/\.pdf$/i, "")}_pages_${splitRanges().replace(/[^0-9-]/g, "_")}.pdf`;
      const savePath = await save({
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        defaultPath: defaultName,
      });

      if (savePath) {
        const blob = new Blob([splitBytes], { type: "application/pdf" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = savePath.split(/[/\\]/).pop() || defaultName;
        a.click();
        URL.revokeObjectURL(a.href);
        success(
          language() === "zh" ? "拆分成功" : "Split Successful",
          language() === "zh" ? `已导出指定 ${indices.length} 页` : `Extracted ${indices.length} pages`
        );
      }
    } catch (e) {
      toastError(language() === "zh" ? "拆分失败" : "Split Failed", String(e));
    } finally {
      setProcessing(false);
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
                <Archive size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "PDF 页面合并与拆分" : "Merge & Split PDF Organizer"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "多文档顺序合并，按页码抽取拆分，本地秒级处理"
                    : "Merge multiple PDFs, extract or split custom page ranges instantly and locally"}
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

          {/* Mode Switcher Bar */}
          <div class="px-6 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <div class="inline-flex p-1 bg-secondary/50 rounded-xl border border-border text-xs font-medium">
              <button
                onClick={() => setActiveTab("merge")}
                class={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab() === "merge"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers size={13} />
                <span>{language() === "zh" ? "合并多个 PDF" : "Merge PDFs"}</span>
              </button>
              <button
                onClick={() => setActiveTab("split")}
                class={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab() === "split"
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Scissors size={13} />
                <span>{language() === "zh" ? "按页拆分提取" : "Split & Extract Pages"}</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Merge View */}
          <Show when={activeTab() === "merge"}>
            <div class="flex flex-col flex-1 overflow-hidden">
              <div class="px-6 py-2.5 border-b border-border bg-background flex items-center justify-between text-xs">
                <button
                  onClick={handleAddMergeFiles}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-all shadow-xs border border-border"
                >
                  <Plus size={13} />
                  <span>{language() === "zh" ? "添加 PDF 文件..." : "Add PDF Files..."}</span>
                </button>

                <div class="flex items-center gap-3">
                  <span class="text-muted-foreground font-mono text-[11px]">
                    {mergeItems().length} {language() === "zh" ? "个文档" : "documents"}
                  </span>
                  <button
                    onClick={handleExecuteMerge}
                    disabled={processing() || mergeItems().length === 0}
                    class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
                  >
                    <Show when={processing()} fallback={<Download size={13} />}>
                      <RefreshCw size={13} class="animate-spin" />
                    </Show>
                    <span>{processing() ? (language() === "zh" ? "正在合并..." : "Merging...") : (language() === "zh" ? "开始合并" : "Merge and Export")}</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div class="flex-1 overflow-auto p-4 space-y-2 bg-muted/10 min-h-[350px]">
                <Show
                  when={mergeItems().length > 0}
                  fallback={
                    <div class="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
                      <Archive size={40} class="opacity-20 mb-3" />
                      <p class="text-xs">
                        {language() === "zh"
                          ? "暂无待合并的 PDF 文件。点击上方「添加 PDF 文件」开始。"
                          : "No PDFs added yet. Click 'Add PDF Files' above to begin."}
                      </p>
                    </div>
                  }
                >
                  <For each={mergeItems()}>
                    {(item, idx) => (
                      <div class="p-3 bg-background border border-border rounded-xl flex items-center justify-between gap-3 shadow-xs">
                        <div class="flex items-center gap-3 truncate">
                          <span class="w-6 text-center font-mono text-xs font-bold text-muted-foreground">
                            {idx() + 1}
                          </span>
                          <div class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                            <FileText size={15} />
                          </div>
                          <div class="truncate">
                            <p class="text-xs font-semibold text-foreground truncate">{item.name}</p>
                            <p class="text-[10px] text-muted-foreground font-mono truncate">
                              {item.pageCount} {language() === "zh" ? "页" : "pages"} • {item.path}
                            </p>
                          </div>
                        </div>

                        <div class="flex items-center gap-2 flex-shrink-0">
                          {/* Page Range input */}
                          <div class="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg border border-border/60">
                            <span>{language() === "zh" ? "范围:" : "Range:"}</span>
                            <input
                              type="text"
                              value={item.pageRange}
                              onInput={(e) => {
                                const val = e.currentTarget.value;
                                setMergeItems((prev) =>
                                  prev.map((it, i) => (i === idx() ? { ...it, pageRange: val } : it))
                                );
                              }}
                              placeholder="e.g. 1-3, 5"
                              class="w-20 bg-transparent text-foreground font-mono outline-none text-xs"
                            />
                          </div>

                          {/* Reorder Buttons */}
                          <button
                            onClick={() => {
                              if (idx() > 0) {
                                const list = [...mergeItems()];
                                const temp = list[idx() - 1];
                                list[idx() - 1] = list[idx()];
                                list[idx()] = temp;
                                setMergeItems(list);
                              }
                            }}
                            disabled={idx() === 0}
                            class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (idx() < mergeItems().length - 1) {
                                const list = [...mergeItems()];
                                const temp = list[idx() + 1];
                                list[idx() + 1] = list[idx()];
                                list[idx()] = temp;
                                setMergeItems(list);
                              }
                            }}
                            disabled={idx() === mergeItems().length - 1}
                            class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30"
                          >
                            <ArrowDown size={13} />
                          </button>

                          <button
                            onClick={() => setMergeItems((prev) => prev.filter((_, i) => i !== idx()))}
                            class="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </Show>

          {/* Tab 2: Split View */}
          <Show when={activeTab() === "split"}>
            <div class="flex-1 p-6 flex flex-col items-center justify-center gap-6 overflow-auto">
              <Show
                when={splitFile()}
                fallback={
                  <div class="text-center space-y-4 max-w-sm">
                    <div class="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto text-muted-foreground">
                      <Scissors size={28} />
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-foreground">
                        {language() === "zh" ? "选择需要拆分的 PDF 文档" : "Select a PDF to Split"}
                      </h4>
                      <p class="text-xs text-muted-foreground mt-1">
                        {language() === "zh"
                          ? "支持按指定单页或自定义页码范围提取并导出新文档"
                          : "Extract specific pages or page ranges into a new document"}
                      </p>
                    </div>
                    <button
                      onClick={handleSelectSplitFile}
                      class="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-xs"
                    >
                      {language() === "zh" ? "打开 PDF 文件..." : "Open PDF File..."}
                    </button>
                  </div>
                }
              >
                <div class="w-full max-w-md bg-background border border-border rounded-2xl p-5 space-y-5 shadow-xs">
                  <div class="flex items-center justify-between pb-3 border-b border-border">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p class="text-xs font-bold text-foreground truncate max-w-[200px]">
                          {splitFile()!.name}
                        </p>
                        <p class="text-[10px] text-muted-foreground font-mono">
                          {language() === "zh" ? "总计" : "Total"} {splitFile()!.pageCount} {language() === "zh" ? "页" : "pages"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSplitFile(null)}
                      class="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {language() === "zh" ? "更换文件" : "Change"}
                    </button>
                  </div>

                  {/* Range Config */}
                  <div class="space-y-2">
                    <label class="text-xs font-medium text-foreground block">
                      {language() === "zh" ? "指定提取的页码范围 (如: 1-3, 5):" : "Specify pages to extract (e.g. 1-3, 5):"}
                    </label>
                    <input
                      type="text"
                      value={splitRanges()}
                      onInput={(e) => setSplitRanges(e.currentTarget.value)}
                      placeholder="e.g. 1-3, 5, 8-10"
                      class="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-border bg-secondary/30 text-foreground outline-none focus:border-primary transition-all"
                    />
                    <p class="text-[10px] text-muted-foreground">
                      {language() === "zh"
                        ? "输入连续范围如 1-5 或逗号分隔如 1, 3, 5，全部页码请输入 all"
                        : "Use ranges (1-5) or comma-separated numbers (1, 3, 5). Type 'all' for all pages."}
                    </p>
                  </div>

                  <button
                    onClick={handleExecuteSplit}
                    disabled={processing()}
                    class="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Show when={processing()} fallback={<Download size={14} />}>
                      <RefreshCw size={14} class="animate-spin" />
                    </Show>
                    <span>{processing() ? (language() === "zh" ? "正在导出..." : "Extracting...") : (language() === "zh" ? "导出提取的 PDF" : "Extract & Save PDF")}</span>
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
