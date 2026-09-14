import { createSignal, Show, For } from "solid-js";
import { X, Fingerprint, Copy, Check, FileUp, AlertCircle } from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { calculateFileHash, FileChecksums } from "../../services/toolbox";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function FileHashModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = createSignal(false);
  const [checksums, setChecksums] = createSignal<FileChecksums | null>(null);
  const [compareHash, setCompareHash] = createSignal("");
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const processFile = async (path: string) => {
    setLoading(true);
    try {
      const res = await calculateFileHash(path);
      setChecksums(res);
      success(
        language() === "zh" ? "哈希计算完成" : "Hash calculation complete",
        res.file_name
      );
    } catch (e: any) {
      toastError(
        language() === "zh" ? "计算哈希失败" : "Failed to calculate hash",
        e?.message || String(e)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });
      if (selected && typeof selected === "string") {
        await processFile(selected);
      }
    } catch (e: any) {
      toastError(
        language() === "zh" ? "打开文件失败" : "Failed to open file",
        e?.message || String(e)
      );
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      success(language() === "zh" ? "已复制到剪贴板" : "Copied to clipboard");
    } catch (e) {
      // fallback
    }
  };

  const isMatching = (hashValue: string) => {
    const target = compareHash().trim().toLowerCase();
    if (!target) return null;
    return hashValue.toLowerCase() === target;
  };

  const hashItems = () => {
    const data = checksums();
    if (!data) return [];
    return [
      { key: "MD5", value: data.md5 },
      { key: "SHA-1", value: data.sha1 },
      { key: "SHA-256", value: data.sha256 },
      { key: "SHA-512", value: data.sha512 },
    ];
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div class="flex items-center space-x-2.5">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <Fingerprint size={20} />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-foreground">
                  {language() === "zh" ? "文件哈希计算器" : "File Hash Calculator"}
                </h3>
                <p class="text-[11px] text-muted-foreground">
                  {language() === "zh"
                    ? "计算文件的 MD5、SHA-1、SHA-256 与 SHA-512 校验和并核对"
                    : "Calculate & verify MD5, SHA-1, SHA-256, and SHA-512 checksums"}
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
            {/* Drop Zone */}
            <div
              onClick={handleSelectFile}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                  const file = e.dataTransfer.files[0];
                  // If path is available on file object
                  const path = (file as any).path || (file as any).webkitRelativePath;
                  if (path) {
                    processFile(path);
                  }
                }
              }}
              class={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging()
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              }`}
            >
              <FileUp size={32} class="mx-auto text-muted-foreground mb-2" />
              <p class="text-xs font-semibold text-foreground">
                {language() === "zh" ? "点击选取文件或拖放至此处" : "Click to select a file or drag & drop"}
              </p>
              <p class="text-[11px] text-muted-foreground mt-0.5">
                {language() === "zh" ? "支持任意大小与类型的文件（流式高速计算）" : "Supports files of any size (fast streaming hashing)"}
              </p>
            </div>

            {/* Checksums Display */}
            <Show when={loading()}>
              <div class="py-8 text-center text-xs text-muted-foreground animate-pulse">
                {language() === "zh" ? "正在读取文件并计算哈希值..." : "Reading file & calculating hashes..."}
              </div>
            </Show>

            <Show when={!loading() && checksums()}>
              {(data) => (
                <div class="space-y-3">
                  {/* File Info */}
                  <div class="p-3 bg-secondary/50 rounded-lg border border-border text-xs flex items-center justify-between">
                    <div class="min-w-0 pr-2">
                      <span class="font-medium text-foreground truncate block">{data().file_name}</span>
                      <span class="text-[11px] text-muted-foreground font-mono truncate block">{data().file_path}</span>
                    </div>
                    <span class="text-xs font-mono font-medium text-primary px-2 py-0.5 bg-primary/10 rounded-md whitespace-nowrap">
                      {formatBytes(data().file_size)}
                    </span>
                  </div>

                  {/* Hash Verify Input */}
                  <div class="space-y-1.5">
                    <label class="text-[11px] font-medium text-muted-foreground">
                      {language() === "zh" ? "校验和对比（可选）" : "Verify Against Expected Hash (Optional)"}
                    </label>
                    <input
                      type="text"
                      value={compareHash()}
                      onInput={(e) => setCompareHash(e.currentTarget.value)}
                      placeholder={
                        language() === "zh"
                          ? "粘贴官方或已知哈希值进行自动比对..."
                          : "Paste expected hash to compare automatically..."
                      }
                      class="w-full h-8 px-3 bg-background border border-input rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* Hashes List */}
                  <div class="space-y-2">
                    <For each={hashItems()}>
                      {(item) => {
                        const match = () => isMatching(item.value);
                        return (
                          <div class="p-2.5 bg-card border border-border rounded-lg space-y-1">
                            <div class="flex items-center justify-between">
                              <span class="text-[11px] font-semibold text-muted-foreground uppercase">
                                {item.key}
                              </span>
                              <div class="flex items-center space-x-1.5">
                                <Show when={match() !== null}>
                                  <Show
                                    when={match()}
                                    fallback={
                                      <span class="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                                        <AlertCircle size={10} />
                                        {language() === "zh" ? "不匹配" : "Mismatch"}
                                      </span>
                                    }
                                  >
                                    <span class="inline-flex items-center gap-1 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                                      <Check size={10} />
                                      {language() === "zh" ? "匹配一致" : "Matched"}
                                    </span>
                                  </Show>
                                </Show>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(item.value, item.key)}
                                  class="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                                  title={language() === "zh" ? "复制" : "Copy"}
                                >
                                  <Show when={copiedKey() === item.key} fallback={<Copy size={13} />}>
                                    <Check size={13} class="text-emerald-500" />
                                  </Show>
                                </button>
                              </div>
                            </div>
                            <div class="font-mono text-xs text-foreground break-all select-all bg-muted/40 p-1.5 rounded">
                              {item.value}
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </div>

          {/* Footer */}
          <div class="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end">
            <button
              onClick={props.onClose}
              class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 transition-colors"
            >
              {language() === "zh" ? "关闭" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
