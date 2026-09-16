import { createSignal, For, Show } from "solid-js";
import {
  X,
  FileText,
  FolderOpen,
  Play,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { convertWordToPdf, WordConvertResult } from "../../services/toolbox";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface DocEntry {
  path: string;
  name: string;
}

export function WordToPdfModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError } = useToast();

  const [files, setFiles] = createSignal<DocEntry[]>([]);
  const [outputDir, setOutputDir] = createSignal<string>("");
  const [loading, setLoading] = createSignal(false);
  const [results, setResults] = createSignal<Record<string, WordConvertResult>>({});

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Word Documents",
            extensions: ["docx", "doc"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        const newEntries: DocEntry[] = selected.map((p) => ({
          path: p,
          name: p.split(/[/\\]/).pop() || p,
        }));

        const existing = new Set(files().map((f) => f.path));
        setFiles([...files(), ...newEntries.filter((f) => !existing.has(f.path))]);
      }
    } catch (e) {
      toastError(language() === "zh" ? "选择文档失败" : "Failed to select documents", String(e));
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
      toastError(language() === "zh" ? "选择目录失败" : "Failed to select folder", String(e));
    }
  };

  const handleConvert = async () => {
    const list = files();
    if (list.length === 0) return;

    setLoading(true);
    let successCount = 0;
    const newResults: Record<string, WordConvertResult> = { ...results() };

    for (const file of list) {
      try {
        let outPath: string | null = null;
        if (outputDir()) {
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          outPath = `${outputDir()}\\${baseName}.pdf`;
        }

        const res = await convertWordToPdf({
          source_path: file.path,
          output_path: outPath,
        });

        newResults[file.path] = res;
        setResults({ ...newResults });

        if (res.success) {
          successCount++;
        }
      } catch (err: any) {
        newResults[file.path] = {
          source_path: file.path,
          output_path: "",
          success: false,
          error_message: String(err?.message || err),
        };
        setResults({ ...newResults });
      }
    }

    setLoading(false);
    if (successCount > 0) {
      success(
        language() === "zh" ? "转换完成" : "Conversion Complete",
        language() === "zh"
          ? `成功转换 ${successCount} 个 Word 文档为 PDF`
          : `Successfully converted ${successCount} Word document(s) to PDF`
      );
    } else {
      toastError(
        language() === "zh" ? "转换未完成" : "Conversion Incomplete",
        language() === "zh"
          ? "请确保本机已安装 Microsoft Word 或 WPS Office"
          : "Please ensure Microsoft Word or WPS Office is installed"
      );
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
                <FileText size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "Word 转 PDF 文档转换器" : "Word to PDF Converter"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "将 DOCX 与 DOC 文档无损转换为便携 PDF 格式，支持批量转换"
                    : "High-fidelity DOCX & DOC to portable PDF batch converter"}
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

          {/* Action Toolbar */}
          <div class="px-6 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2.5">
              <button
                onClick={handleSelectFiles}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-all shadow-xs border border-border"
              >
                <FolderOpen size={13} />
                <span>{language() === "zh" ? "添加 Word 文档..." : "Add Word Docs..."}</span>
              </button>

              <button
                onClick={handleSelectOutputDir}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground font-medium transition-all border border-border/60"
              >
                <Download size={13} />
                <span class="truncate max-w-[200px]">
                  {outputDir()
                    ? (language() === "zh" ? "输出目录: " : "Dir: ") + outputDir().split(/[/\\]/).pop()
                    : (language() === "zh" ? "指定保存目录 (默认原目录)" : "Output Folder (Default: Same)")}
                </span>
              </button>

              <Show when={files().length > 0}>
                <button
                  onClick={() => {
                    setFiles([]);
                    setResults({});
                  }}
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 size={13} />
                  <span>{language() === "zh" ? "清空" : "Clear"}</span>
                </button>
              </Show>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-muted-foreground font-mono text-[11px]">
                {files().length} {language() === "zh" ? "个文档" : "documents"}
              </span>

              <button
                onClick={handleConvert}
                disabled={loading() || files().length === 0}
                class="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
              >
                <Show when={loading()} fallback={<Play size={13} />}>
                  <RefreshCw size={13} class="animate-spin" />
                </Show>
                <span>{loading() ? (language() === "zh" ? "正在转换..." : "Converting...") : (language() === "zh" ? "开始转换为 PDF" : "Convert to PDF")}</span>
              </button>
            </div>
          </div>

          {/* Documents List */}
          <div class="flex-1 overflow-auto p-4 space-y-2 bg-muted/10 min-h-[350px]">
            <Show
              when={files().length > 0}
              fallback={
                <div class="h-full flex flex-col items-center justify-center text-muted-foreground py-16">
                  <FileText size={42} class="opacity-20 mb-3" />
                  <p class="text-xs">
                    {language() === "zh"
                      ? "暂无待转换的 Word 文档。点击上方按钮添加 .docx 或 .doc 文件。"
                      : "No Word documents added. Click 'Add Word Docs...' to begin."}
                  </p>
                </div>
              }
            >
              <For each={files()}>
                {(file, idx) => {
                  const res = () => results()[file.path];
                  return (
                    <div class="p-3 bg-background border border-border rounded-xl flex items-center justify-between gap-3 shadow-xs">
                      <div class="flex items-center gap-3 truncate">
                        <div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                          DOC
                        </div>
                        <div class="truncate">
                          <p class="text-xs font-semibold text-foreground truncate">{file.name}</p>
                          <p class="text-[10px] text-muted-foreground font-mono truncate">{file.path}</p>
                        </div>
                      </div>

                      <div class="flex items-center gap-3 flex-shrink-0">
                        <Show when={res()}>
                          {(r) => (
                            <Show
                              when={r().success}
                              fallback={
                                <span class="text-destructive text-[11px] flex items-center gap-1 max-w-[200px] truncate" title={r().error_message || ""}>
                                  <AlertTriangle size={13} class="flex-shrink-0" />
                                  <span class="truncate">{r().error_message || (language() === "zh" ? "失败" : "Failed")}</span>
                                </span>
                              }
                            >
                              <span class="text-green-600 text-[11px] font-mono flex items-center gap-1">
                                <CheckCircle2 size={14} class="text-green-500" />
                                <span>{language() === "zh" ? "已转为 PDF" : "Converted"}</span>
                              </span>
                            </Show>
                          )}
                        </Show>

                        <button
                          onClick={() => {
                            setFiles((prev) => prev.filter((_, i) => i !== idx()));
                            const newRes = { ...results() };
                            delete newRes[file.path];
                            setResults(newRes);
                          }}
                          class="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
