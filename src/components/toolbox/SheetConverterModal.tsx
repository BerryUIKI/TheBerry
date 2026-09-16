import { createSignal, Show, For, onCleanup } from "solid-js";
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  Copy,
  Check,
  Table,
  Layers,
  ArrowRightLeft,
  Settings2,
  FileText,
} from "lucide-solid";
import * as XLSX from "xlsx";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ExportTarget = "xlsx" | "csv" | "tsv" | "json";

export function SheetConverterModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError, info } = useToast();

  const [fileName, setFileName] = createSignal<string>("");
  const [workbook, setWorkbook] = createSignal<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = createSignal<string[]>([]);
  const [activeSheet, setActiveSheet] = createSignal<string>("");
  const [tableHeaders, setTableHeaders] = createSignal<string[]>([]);
  const [tableRows, setTableRows] = createSignal<any[][]>([]);
  const [exportFormat, setExportFormat] = createSignal<ExportTarget>("csv");
  const [includeBom, setIncludeBom] = createSignal(true);
  const [copied, setCopied] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal(1);
  const pageSize = 20;

  const loadWorkbookData = (wb: XLSX.WorkBook, sourceName: string) => {
    setWorkbook(wb);
    setFileName(sourceName);
    setSheetNames(wb.SheetNames);
    if (wb.SheetNames.length > 0) {
      selectSheet(wb.SheetNames[0], wb);
    }
  };

  const selectSheet = (name: string, wb = workbook()) => {
    if (!wb) return;
    setActiveSheet(name);
    setCurrentPage(1);
    const sheet = wb.Sheets[name];
    if (!sheet) {
      setTableHeaders([]);
      setTableRows([]);
      return;
    }

    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (data.length > 0) {
      const headers = data[0].map((h: any, i: number) => String(h || `Col_${i + 1}`));
      setTableHeaders(headers);
      setTableRows(data.slice(1));
    } else {
      setTableHeaders([]);
      setTableRows([]);
    }
  };

  // Sample default workbook so user sees table immediately
  const initDefaultData = () => {
    const sample = [
      ["Product ID", "Item Name", "Category", "Stock", "Price ($)", "Status"],
      ["P1001", "MacBook Pro 16", "Laptops", "42", "2499.00", "In Stock"],
      ["P1002", "Dell XPS 15", "Laptops", "18", "1899.00", "Low Stock"],
      ["P1003", "Sony WH-1000XM5", "Audio", "110", "399.00", "In Stock"],
      ["P1004", "Keychron Q1 Pro", "Accessories", "65", "199.00", "In Stock"],
      ["P1005", "Logitech MX Master 3S", "Accessories", "88", "99.00", "In Stock"],
      ["P1006", "LG UltraFine 4K", "Displays", "12", "699.00", "Low Stock"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    loadWorkbookData(wb, "Sample_Inventory.xlsx");
  };

  if (!workbook()) {
    initDefaultData();
  }

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Spreadsheet / Data",
            extensions: ["xlsx", "xls", "csv", "tsv"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const response = await fetch(`tauri://localhost/${encodeURIComponent(selected)}`).catch(() => null);
        // If local tauri fetch not direct, read via array buffer in Tauri plugin or FileReader
        // In Tauri v2, let's use input fetch or binary read
        const fileContent = await window.__TAURI__?.core.invoke<number[]>("plugin:fs|read_file", {
          path: selected,
        }).catch(() => null);

        let wb: XLSX.WorkBook;
        if (fileContent) {
          const u8 = new Uint8Array(fileContent);
          wb = XLSX.read(u8, { type: "array" });
        } else {
          // Fallback fetch
          const res = await fetch(`http://asset.localhost/${selected.replace(/\\/g, "/")}`);
          const buf = await res.arrayBuffer();
          wb = XLSX.read(buf, { type: "array" });
        }

        const name = selected.split(/[/\\]/).pop() || "spreadsheet";
        loadWorkbookData(wb, name);
        success(language() === "zh" ? "已载入表格文件" : "Workbook loaded successfully", name);
      }
    } catch (e) {
      toastError(language() === "zh" ? "打开文件失败" : "Failed to open file", String(e));
    }
  };

  const getExportData = (): { content: string | Uint8Array; mime: string; ext: string } => {
    const wb = workbook();
    if (!wb || !activeSheet()) return { content: "", mime: "text/plain", ext: "txt" };

    const sheet = wb.Sheets[activeSheet()];
    const fmt = exportFormat();

    if (fmt === "csv") {
      let csv = XLSX.utils.sheet_to_csv(sheet, { FS: "," });
      if (includeBom()) {
        csv = "\uFEFF" + csv;
      }
      return { content: csv, mime: "text/csv;charset=utf-8;", ext: "csv" };
    }

    if (fmt === "tsv") {
      let tsv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
      if (includeBom()) {
        tsv = "\uFEFF" + tsv;
      }
      return { content: tsv, mime: "text/tab-separated-values;charset=utf-8;", ext: "tsv" };
    }

    if (fmt === "json") {
      const json = XLSX.utils.sheet_to_json(sheet);
      return {
        content: JSON.stringify(json, null, 2),
        mime: "application/json;charset=utf-8;",
        ext: "json",
      };
    }

    // XLSX format
    const outBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return {
      content: new Uint8Array(outBuf),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ext: "xlsx",
    };
  };

  const handleExport = async () => {
    try {
      const { content, ext } = getExportData();
      if (!content) return;

      const base = fileName().replace(/\.[^/.]+$/, "");
      const defaultName = `${base}_converted.${ext}`;

      const targetPath = await save({
        filters: [
          {
            name: ext.toUpperCase(),
            extensions: [ext],
          },
        ],
        defaultPath: defaultName,
      });

      if (targetPath) {
        let blob: Blob;
        if (typeof content === "string") {
          blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        } else {
          blob = new Blob([content]);
        }

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = targetPath.split(/[/\\]/).pop() || defaultName;
        a.click();
        URL.revokeObjectURL(a.href);
        success(language() === "zh" ? "转换并导出成功" : "Successfully converted & saved", targetPath);
      }
    } catch (e) {
      toastError(language() === "zh" ? "导出失败" : "Export failed", String(e));
    }
  };

  const handleCopy = async () => {
    try {
      const { content } = getExportData();
      if (!content) return;
      const text = typeof content === "string" ? content : "[Binary Excel Data]";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success(language() === "zh" ? "表格数据已复制" : "Copied to clipboard");
    } catch (e) {
      toastError(language() === "zh" ? "复制失败" : "Failed to copy", String(e));
    }
  };

  const paginatedRows = () => {
    const rows = tableRows();
    const start = (currentPage() - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  };

  const totalPages = () => Math.max(1, Math.ceil(tableRows().length / pageSize));

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-foreground">
          {/* Header */}
          <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "Excel / CSV 表格转换" : "Excel & CSV Spreadsheet Converter"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "在 XLSX、XLS、CSV 与 TSV 间无损互转，支持多工作表与结构化预览"
                    : "Fast bi-directional converter for XLSX, XLS, CSV & TSV with multi-sheet preview"}
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

          {/* Controls & Toolbar */}
          <div class="px-6 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <button
                onClick={handleSelectFile}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
              >
                <Upload size={13} />
                <span>{language() === "zh" ? "打开表格文件..." : "Open Spreadsheet..."}</span>
              </button>

              <Show when={sheetNames().length > 1}>
                <div class="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border text-xs">
                  <span class="text-muted-foreground px-2 text-[11px] font-medium flex items-center gap-1">
                    <Layers size={12} />
                    {language() === "zh" ? "工作表:" : "Sheet:"}
                  </span>
                  <For each={sheetNames()}>
                    {(name) => (
                      <button
                        onClick={() => selectSheet(name)}
                        class={`px-2.5 py-1 rounded-lg transition-all ${
                          activeSheet() === name
                            ? "bg-background text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {name}
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <div class="text-xs text-muted-foreground font-mono">
                {fileName() && (
                  <span class="px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[11px]">
                    {fileName()} ({tableRows().length} {language() === "zh" ? "行" : "rows"})
                  </span>
                )}
              </div>
            </div>

            {/* Target Export Format Selector */}
            <div class="flex items-center gap-2">
              <div class="inline-flex p-1 bg-secondary/50 rounded-xl border border-border text-xs font-medium">
                <button
                  onClick={() => setExportFormat("csv")}
                  class={`px-2.5 py-1 rounded-lg transition-all ${
                    exportFormat() === "csv"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat("xlsx")}
                  class={`px-2.5 py-1 rounded-lg transition-all ${
                    exportFormat() === "xlsx"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  XLSX
                </button>
                <button
                  onClick={() => setExportFormat("tsv")}
                  class={`px-2.5 py-1 rounded-lg transition-all ${
                    exportFormat() === "tsv"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  TSV
                </button>
                <button
                  onClick={() => setExportFormat("json")}
                  class={`px-2.5 py-1 rounded-lg transition-all ${
                    exportFormat() === "json"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  JSON
                </button>
              </div>

              <Show when={exportFormat() === "csv" || exportFormat() === "tsv"}>
                <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded-lg hover:bg-secondary/50">
                  <input
                    type="checkbox"
                    checked={includeBom()}
                    onChange={(e) => setIncludeBom(e.currentTarget.checked)}
                    class="rounded border-border text-primary focus:ring-0"
                  />
                  <span title="UTF-8 with BOM ensures Excel opens without garbled Chinese / international characters">
                    BOM {language() === "zh" ? "(兼容Excel)" : "(Excel Safe)"}
                  </span>
                </label>
              </Show>

              <button
                onClick={handleCopy}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-all shadow-xs border border-border/60"
              >
                <Show when={copied()} fallback={<Copy size={13} />}>
                  <Check size={13} class="text-green-500" />
                </Show>
                <span>{copied() ? (language() === "zh" ? "已复制" : "Copied") : (language() === "zh" ? "复制" : "Copy")}</span>
              </button>

              <button
                onClick={handleExport}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
              >
                <Download size={13} />
                <span>{language() === "zh" ? "导出文件" : "Export"}</span>
              </button>
            </div>
          </div>

          {/* Table Data Preview */}
          <div class="flex-1 overflow-auto p-4 bg-muted/10 min-h-[380px]">
            <Show
              when={tableHeaders().length > 0}
              fallback={
                <div class="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
                  <Table size={40} class="opacity-20 mb-3" />
                  <p class="text-xs">
                    {language() === "zh"
                      ? "未载入表格数据，请点击上方按钮选择文件"
                      : "No spreadsheet loaded. Click above to open a file."}
                  </p>
                </div>
              }
            >
              <div class="border border-border rounded-xl overflow-hidden bg-background shadow-xs">
                <table class="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr class="bg-secondary/40 border-b border-border text-foreground font-semibold">
                      <th class="p-2.5 text-center text-muted-foreground w-12 border-r border-border/60 text-[11px] font-mono">
                        #
                      </th>
                      <For each={tableHeaders()}>
                        {(col) => (
                          <th class="p-2.5 border-r border-border/60 last:border-r-0 truncate max-w-[200px]">
                            {col}
                          </th>
                        )}
                      </For>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={paginatedRows()}>
                      {(row, idx) => (
                        <tr class="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td class="p-2 text-center text-muted-foreground font-mono text-[10px] border-r border-border/60 bg-muted/10">
                            {(currentPage() - 1) * pageSize + idx() + 1}
                          </td>
                          <For each={tableHeaders()}>
                            {(_, colIdx) => (
                              <td class="p-2.5 border-r border-border/40 last:border-r-0 truncate max-w-[200px] text-foreground">
                                {String(row[colIdx()] ?? "")}
                              </td>
                            )}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>

          {/* Pagination Footer */}
          <div class="px-6 py-3 border-t border-border bg-background flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {language() === "zh" ? "显示第" : "Page"} {currentPage()} / {totalPages()}{" "}
              {language() === "zh" ? "页" : ""} ({tableRows().length} {language() === "zh" ? "行" : "rows"})
            </span>

            <div class="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage() <= 1}
                class="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-40"
              >
                {language() === "zh" ? "上一页" : "Previous"}
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages(), p + 1))}
                disabled={currentPage() >= totalPages()}
                class="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 text-foreground disabled:opacity-40"
              >
                {language() === "zh" ? "下一页" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
