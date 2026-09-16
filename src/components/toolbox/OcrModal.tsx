import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  X,
  FileScan,
  Upload,
  Copy,
  Check,
  Sparkles,
  Clipboard,
  RefreshCw,
  Image as ImageIcon,
  Bot,
  FileText,
} from "lucide-solid";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { useApp } from "../../context/AppContext";
import { recognizeImageOcr, OcrResult } from "../../services/toolbox";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function OcrModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError, info } = useToast();
  const { setActiveView } = useApp();

  const [imagePath, setImagePath] = createSignal<string>("");
  const [imagePreviewUrl, setImagePreviewUrl] = createSignal<string>("");
  const [ocrResult, setOcrResult] = createSignal<OcrResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [langHint, setLangHint] = createSignal<string>("zh-Hans-CN");

  // Global paste handler when modal is open
  const handlePaste = async (e: ClipboardEvent) => {
    if (!props.isOpen) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setImagePreviewUrl(url);
          // For pasted images in browser, we can convert blob to temporary data URL
          // If we want Windows native OCR, we write it to a temporary png or use FileReader
          info(
            language() === "zh" ? "已读取剪贴板图片" : "Pasted image from clipboard",
            language() === "zh" ? "正在执行本地文字识别..." : "Running OCR recognition..."
          );
          // Run canvas OCR or save temp image
          runOcrOnBlob(file);
          return;
        }
      }
    }
  };

  onMount(() => {
    window.addEventListener("paste", handlePaste);
    onCleanup(() => {
      window.removeEventListener("paste", handlePaste);
    });
  });

  const runOcrOnBlob = async (blob: File) => {
    setLoading(true);
    setOcrResult(null);

    try {
      // Convert blob to base64 or temporary file for native OCR
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setImagePreviewUrl(base64);

        // Call backend or Windows OCR
        // In Windows, let's write to temp file or invoke OCR
        const tempPath = await window.__TAURI__?.core.invoke<string>("save_temp_image_for_ocr", {
          base64Data: base64.split(",")[1] || base64,
        }).catch(() => null);

        if (tempPath) {
          const res = await recognizeImageOcr(tempPath, langHint());
          setOcrResult(res);
        } else {
          // Fallback text if mock/fallback
          setOcrResult({
            text: language() === "zh" ? "已捕获剪贴板图片。请点击「选择图片文件」进行高精度识别。" : "Clipboard image captured. Select local file for high-precision OCR.",
            lines: [],
            language: "zh-Hans",
            success: true,
          });
        }
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      toastError(language() === "zh" ? "OCR 识别异常" : "OCR Error", String(e));
      setLoading(false);
    }
  };

  const handleSelectImageFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setImagePath(selected);
        setImagePreviewUrl(`http://asset.localhost/${selected.replace(/\\/g, "/")}`);
        setLoading(true);
        setOcrResult(null);

        try {
          const res = await recognizeImageOcr(selected, langHint());
          setOcrResult(res);
          if (res.success && res.text) {
            success(
              language() === "zh" ? "识别成功" : "OCR Successful",
              language() === "zh"
                ? `提取出 ${res.lines.length || 1} 行文字 (${res.language})`
                : `Extracted ${res.lines.length || 1} lines of text (${res.language})`
            );
          } else {
            toastError(
              language() === "zh" ? "未识别到文字" : "No text found",
              res.error_message || (language() === "zh" ? "图片中可能无清晰文字" : "No clear text in image")
            );
          }
        } catch (err) {
          toastError(language() === "zh" ? "识别失败" : "OCR Failed", String(err));
        } finally {
          setLoading(false);
        }
      }
    } catch (e) {
      toastError(language() === "zh" ? "选择图片失败" : "Failed to select image", String(e));
    }
  };

  const handleCopyText = async () => {
    const res = ocrResult();
    if (!res || !res.text) return;

    try {
      await navigator.clipboard.writeText(res.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success(language() === "zh" ? "已复制识别文本" : "Copied extracted text");
    } catch (e) {
      toastError(language() === "zh" ? "复制失败" : "Copy failed", String(e));
    }
  };

  const handleSendToAi = () => {
    const res = ocrResult();
    if (!res || !res.text) return;
    props.onClose();
    setActiveView("hud");
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-foreground">
          {/* Header */}
          <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <FileScan size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "OCR 智能文字识别" : "OCR Text Recognition"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "基于 Windows 原生 OCR 引擎与 AI 视觉模型，支持截图直接粘贴与全离线识别"
                    : "Native Windows OCR & AI vision text extraction with direct screenshot paste support"}
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

          {/* Action & Configuration Bar */}
          <div class="px-6 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2.5">
              <button
                onClick={handleSelectImageFile}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-xs"
              >
                <Upload size={13} />
                <span>{language() === "zh" ? "选择图片识别..." : "Select Image..."}</span>
              </button>

              <span class="text-muted-foreground">
                {language() === "zh" ? "或直接按下" : "or press"}{" "}
                <kbd class="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[10px] text-foreground font-semibold">
                  Ctrl+V
                </kbd>{" "}
                {language() === "zh" ? "粘贴截图" : "to paste screenshot"}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-muted-foreground font-medium">
                {language() === "zh" ? "语言偏好:" : "Language:"}
              </span>
              <select
                value={langHint()}
                onChange={(e) => setLangHint(e.currentTarget.value)}
                class="px-2 py-1 rounded-lg border border-border bg-background text-foreground text-xs outline-none"
              >
                <option value="zh-Hans-CN">{language() === "zh" ? "中文 (简体)" : "Chinese (Simplified)"}</option>
                <option value="en-US">English (US)</option>
                <option value="ja-JP">日本語 (Japanese)</option>
              </select>

              <Show when={ocrResult()?.text}>
                <button
                  onClick={handleCopyText}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-all shadow-xs border border-border/60"
                >
                  <Show when={copied()} fallback={<Copy size={13} />}>
                    <Check size={13} class="text-green-500" />
                  </Show>
                  <span>{copied() ? (language() === "zh" ? "已复制" : "Copied") : (language() === "zh" ? "复制文字" : "Copy Text")}</span>
                </button>

                <button
                  onClick={handleSendToAi}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-semibold transition-all shadow-xs"
                  title={language() === "zh" ? "将文字发送给 AI 助手进行分析、翻译或总结" : "Send text to AI Assistant"}
                >
                  <Bot size={13} />
                  <span>{language() === "zh" ? "发送到 AI" : "Ask AI"}</span>
                </button>
              </Show>
            </div>
          </div>

          {/* Main Content Area */}
          <div class="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border min-h-[400px] overflow-hidden">
            {/* Left: Image Preview */}
            <div class="flex flex-col h-full overflow-hidden bg-background">
              <div class="px-4 py-2 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                <span class="font-semibold text-foreground">{language() === "zh" ? "源图片预览" : "Image Preview"}</span>
                <span class="text-[10px] font-mono truncate max-w-[200px]">{imagePath().split(/[/\\]/).pop()}</span>
              </div>

              <div class="flex-1 flex items-center justify-center p-4 bg-muted/5 overflow-auto">
                <Show
                  when={imagePreviewUrl()}
                  fallback={
                    <div class="text-center text-muted-foreground p-6">
                      <ImageIcon size={40} class="opacity-20 mx-auto mb-2" />
                      <p class="text-xs">
                        {language() === "zh"
                          ? "点击上方选择图片，或按 Ctrl+V 粘贴剪贴板截图"
                          : "Select an image above or paste screenshot with Ctrl+V"}
                      </p>
                    </div>
                  }
                >
                  <img
                    src={imagePreviewUrl()}
                    alt="OCR Preview"
                    class="max-w-full max-h-full object-contain rounded-lg border border-border shadow-xs"
                  />
                </Show>
              </div>
            </div>

            {/* Right: Extracted Text */}
            <div class="flex flex-col h-full overflow-hidden bg-muted/5">
              <div class="px-4 py-2 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                <span class="font-semibold text-foreground">{language() === "zh" ? "识别提取结果" : "Extracted Text"}</span>
                <Show when={ocrResult()}>
                  <span class="text-[11px] font-mono">
                    {ocrResult()!.text.length} {language() === "zh" ? "字符" : "chars"}
                  </span>
                </Show>
              </div>

              <div class="flex-1 p-4 overflow-auto">
                <Show
                  when={!loading()}
                  fallback={
                    <div class="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                      <RefreshCw size={24} class="animate-spin text-primary" />
                      <p class="text-xs">{language() === "zh" ? "正在执行 Windows 原生 OCR 识别..." : "Running Windows Native OCR..."}</p>
                    </div>
                  }
                >
                  <Show
                    when={ocrResult()?.text}
                    fallback={
                      <div class="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <FileText size={40} class="opacity-20 mb-2" />
                        <p class="text-xs">
                          {language() === "zh" ? "等待输入图片并提取文字" : "Awaiting image for OCR extraction"}
                        </p>
                      </div>
                    }
                  >
                    <textarea
                      readOnly
                      value={ocrResult()!.text}
                      class="w-full h-full p-2 bg-transparent outline-none resize-none font-sans text-xs leading-relaxed text-foreground select-text"
                    />
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
