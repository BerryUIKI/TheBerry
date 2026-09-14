import { createSignal, createMemo, Show, For } from "solid-js";
import { X, Tags, FolderOpen, Play, CheckCircle2, AlertTriangle, Trash2, ArrowRight } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { batchRenameFiles, RenameItem } from "../../services/toolbox";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface FileEntry {
  original_path: string;
  name: string;
  ext: string;
  dir: string;
}

export function BatchRenameModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError } = useToast();

  const [files, setFiles] = createSignal<FileEntry[]>([]);
  const [findText, setFindText] = createSignal("");
  const [replaceText, setReplaceText] = createSignal("");
  const [isRegex, setIsRegex] = createSignal(false);
  const [prefix, setPrefix] = createSignal("");
  const [suffix, setSuffix] = createSignal("");
  const [numberingStart, setNumberingStart] = createSignal<number | null>(null);
  const [numberingDigits, setNumberingDigits] = createSignal(2);
  const [caseMode, setCaseMode] = createSignal<"none" | "lowercase" | "uppercase" | "titlecase">("none");
  const [loading, setLoading] = createSignal(false);

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
      });
      if (selected && Array.isArray(selected)) {
        const newEntries: FileEntry[] = selected.map((filePath) => {
          // Normalize separators
          const normalized = filePath.replace(/\\/g, "/");
          const lastSlash = normalized.lastIndexOf("/");
          const dir = lastSlash !== -1 ? filePath.substring(0, lastSlash) : "";
          const fullFileName = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;
          const lastDot = fullFileName.lastIndexOf(".");
          const name = lastDot !== -1 && lastDot > 0 ? fullFileName.substring(0, lastDot) : fullFileName;
          const ext = lastDot !== -1 && lastDot > 0 ? fullFileName.substring(lastDot) : "";

          return {
            original_path: filePath,
            name,
            ext,
            dir,
          };
        });

        // Filter duplicates
        const existingPaths = new Set(files().map((f) => f.original_path));
        const merged = [...files(), ...newEntries.filter((e) => !existingPaths.has(e.original_path))];
        setFiles(merged);
      }
    } catch (e: any) {
      toastError(
        language() === "zh" ? "选取文件失败" : "Failed to select files",
        e?.message || String(e)
      );
    }
  };

  const removeFile = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.original_path !== path));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const previewItems = createMemo(() => {
    const list = files();
    const find = findText();
    const replace = replaceText();
    const regexMode = isRegex();
    const pre = prefix();
    const suf = suffix();
    const startNum = numberingStart();
    const pad = numberingDigits();
    const currentCase = caseMode();

    return list.map((file, idx) => {
      let baseName = file.name;

      // 1. Find & Replace
      if (find) {
        try {
          if (regexMode) {
            const reg = new RegExp(find, "g");
            baseName = baseName.replace(reg, replace);
          } else {
            baseName = baseName.split(find).join(replace);
          }
        } catch {
          // invalid regex
        }
      }

      // 2. Case conversion
      if (currentCase === "lowercase") {
        baseName = baseName.toLowerCase();
      } else if (currentCase === "uppercase") {
        baseName = baseName.toUpperCase();
      } else if (currentCase === "titlecase") {
        baseName = baseName.replace(/\b\w/g, (c) => c.toUpperCase());
      }

      // 3. Numbering
      if (startNum !== null && !isNaN(startNum)) {
        const numStr = String(startNum + idx).padStart(pad, "0");
        baseName = `${baseName}_${numStr}`;
      }

      // 4. Prefix & Suffix
      const finalName = `${pre}${baseName}${suf}${file.ext}`;
      const separator = file.original_path.includes("\\") ? "\\" : "/";
      const newPath = file.dir ? `${file.dir}${separator}${finalName}` : finalName;

      return {
        ...file,
        new_name: finalName,
        new_path: newPath,
        is_changed: finalName !== `${file.name}${file.ext}`,
      };
    });
  });

  const handleApplyRename = async () => {
    const items: RenameItem[] = previewItems()
      .filter((i) => i.is_changed)
      .map((i) => ({
        original_path: i.original_path,
        new_path: i.new_path,
      }));

    if (items.length === 0) {
      toastError(
        language() === "zh" ? "没有需要重命名的文件" : "No files need renaming"
      );
      return;
    }

    setLoading(true);
    try {
      const res = await batchRenameFiles(items);
      if (res.failure_count > 0) {
        toastError(
          language() === "zh"
            ? `部分文件重命名失败 (${res.failure_count}/${res.total})`
            : `Some files failed to rename (${res.failure_count}/${res.total})`,
          res.errors.slice(0, 2).join("\n")
        );
      } else {
        success(
          language() === "zh" ? "批量重命名完成" : "Batch rename completed",
          language() === "zh"
            ? `成功重命名 ${res.success_count} 个文件`
            : `Successfully renamed ${res.success_count} files`
        );
      }
      clearFiles();
    } catch (e: any) {
      toastError(
        language() === "zh" ? "重命名过程中出错" : "Error during batch rename",
        e?.message || String(e)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div class="flex items-center space-x-2.5">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <Tags size={20} />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-foreground">
                  {language() === "zh" ? "批量重命名工具" : "Batch File Renamer"}
                </h3>
                <p class="text-[11px] text-muted-foreground">
                  {language() === "zh"
                    ? "通过正则替换、前后缀、数字序号及大小写规则快速批量统一文件名"
                    : "Rename multiple files with regex find/replace, prefixes, sequence numbering, and case rules"}
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div class="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Rules Bar */}
            <div class="p-3.5 bg-secondary/40 border border-border rounded-xl space-y-3">
              {/* Find and Replace */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[11px] font-medium text-foreground">
                      {language() === "zh" ? "查找文本" : "Find"}
                    </label>
                    <label class="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRegex()}
                        onChange={(e) => setIsRegex(e.currentTarget.checked)}
                        class="rounded border-input text-primary focus:ring-primary w-3 h-3"
                      />
                      <span>{language() === "zh" ? "正则表达式" : "Regex"}</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={findText()}
                    onInput={(e) => setFindText(e.currentTarget.value)}
                    placeholder={language() === "zh" ? "要替换的原字符..." : "Pattern or text to find..."}
                    class="w-full h-8 px-2.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-foreground mb-1">
                    {language() === "zh" ? "替换为" : "Replace With"}
                  </label>
                  <input
                    type="text"
                    value={replaceText()}
                    onInput={(e) => setReplaceText(e.currentTarget.value)}
                    placeholder={language() === "zh" ? "新文本..." : "Replacement text..."}
                    class="w-full h-8 px-2.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Prefix / Suffix / Numbering / Case */}
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                <div>
                  <label class="block text-[10px] text-muted-foreground mb-1">
                    {language() === "zh" ? "前缀" : "Prefix"}
                  </label>
                  <input
                    type="text"
                    value={prefix()}
                    onInput={(e) => setPrefix(e.currentTarget.value)}
                    placeholder="prefix_"
                    class="w-full h-7 px-2 bg-background border border-input rounded text-xs text-foreground"
                  />
                </div>
                <div>
                  <label class="block text-[10px] text-muted-foreground mb-1">
                    {language() === "zh" ? "后缀" : "Suffix"}
                  </label>
                  <input
                    type="text"
                    value={suffix()}
                    onInput={(e) => setSuffix(e.currentTarget.value)}
                    placeholder="_suffix"
                    class="w-full h-7 px-2 bg-background border border-input rounded text-xs text-foreground"
                  />
                </div>
                <div>
                  <label class="block text-[10px] text-muted-foreground mb-1">
                    {language() === "zh" ? "起始序号 (可选)" : "Start Number (Opt)"}
                  </label>
                  <input
                    type="number"
                    value={numberingStart() ?? ""}
                    onInput={(e) =>
                      setNumberingStart(e.currentTarget.value === "" ? null : Number(e.currentTarget.value))
                    }
                    placeholder="1"
                    class="w-full h-7 px-2 bg-background border border-input rounded text-xs text-foreground"
                  />
                </div>
                <div>
                  <label class="block text-[10px] text-muted-foreground mb-1">
                    {language() === "zh" ? "大小写转换" : "Case"}
                  </label>
                  <select
                    value={caseMode()}
                    onChange={(e) => setCaseMode(e.currentTarget.value as any)}
                    class="w-full h-7 px-1.5 bg-background border border-input rounded text-xs text-foreground"
                  >
                    <option value="none">{language() === "zh" ? "不变" : "Unchanged"}</option>
                    <option value="lowercase">lowercase</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="titlecase">Title Case</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectFiles}
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <FolderOpen size={14} />
                  <span>{language() === "zh" ? "添加文件" : "Add Files"}</span>
                </button>
                <Show when={files().length > 0}>
                  <button
                    type="button"
                    onClick={clearFiles}
                    class="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-muted-foreground hover:text-destructive text-xs font-medium rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>{language() === "zh" ? "清空列表" : "Clear List"}</span>
                  </button>
                </Show>
              </div>

              <span class="text-xs text-muted-foreground">
                {language() === "zh"
                  ? `共 ${files().length} 个文件 (${previewItems().filter((i) => i.is_changed).length} 项将变更)`
                  : `${files().length} files (${previewItems().filter((i) => i.is_changed).length} will change)`}
              </span>
            </div>

            {/* Table / Preview */}
            <div class="border border-border rounded-xl overflow-hidden min-h-[220px] max-h-[350px] overflow-y-auto bg-background">
              <Show
                when={files().length > 0}
                fallback={
                  <div class="h-48 flex flex-col items-center justify-center text-center p-4">
                    <Tags size={28} class="text-muted-foreground/40 mb-2" />
                    <p class="text-xs font-medium text-foreground">
                      {language() === "zh" ? "尚未添加任何文件" : "No files added yet"}
                    </p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">
                      {language() === "zh"
                        ? "点击“添加文件”按钮导入需要重命名的文件"
                        : "Click 'Add Files' to import files for renaming"}
                    </p>
                  </div>
                }
              >
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="bg-muted/40 border-b border-border text-[11px] text-muted-foreground sticky top-0">
                      <th class="p-2.5 pl-3 font-medium">{language() === "zh" ? "原文件名" : "Original Name"}</th>
                      <th class="p-2.5 font-medium">{language() === "zh" ? "预览新名称" : "New Name Preview"}</th>
                      <th class="p-2.5 pr-3 text-right font-medium">{language() === "zh" ? "操作" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border/60 font-mono">
                    <For each={previewItems()}>
                      {(item) => (
                        <tr class="hover:bg-muted/20 transition-colors group">
                          <td class="p-2.5 pl-3 text-muted-foreground max-w-[250px] truncate">
                            {item.name}
                            {item.ext}
                          </td>
                          <td class="p-2.5 max-w-[280px] truncate">
                            <Show
                              when={item.is_changed}
                              fallback={<span class="text-muted-foreground/60">{item.new_name}</span>}
                            >
                              <span class="text-primary font-medium flex items-center gap-1.5">
                                <ArrowRight size={11} class="text-primary/70 flex-shrink-0" />
                                <span class="truncate">{item.new_name}</span>
                              </span>
                            </Show>
                          </td>
                          <td class="p-2.5 pr-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => removeFile(item.original_path)}
                              class="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                              title={language() === "zh" ? "移除" : "Remove"}
                            >
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <button
              onClick={props.onClose}
              class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 transition-colors"
            >
              {language() === "zh" ? "取消" : "Cancel"}
            </button>
            <button
              disabled={loading() || previewItems().filter((i) => i.is_changed).length === 0}
              onClick={handleApplyRename}
              class="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Play size={13} fill="currentColor" />
              <span>
                {loading()
                  ? language() === "zh"
                    ? "正在重命名..."
                    : "Renaming..."
                  : language() === "zh"
                  ? "执行重命名"
                  : "Apply Rename"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
