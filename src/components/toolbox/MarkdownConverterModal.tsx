import { createSignal, Show } from "solid-js";
import {
  X,
  Type,
  ArrowRightLeft,
  Copy,
  Check,
  Download,
  Eye,
  Code2,
  FileText,
  Sparkles,
  RotateCcw,
} from "lucide-solid";
import { marked } from "marked";
import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import { save } from "@tauri-apps/plugin-dialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ConvertDirection = "md-to-html" | "html-to-md" | "md-to-text";

export function MarkdownConverterModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError, info } = useToast();

  const [direction, setDirection] = createSignal<ConvertDirection>("md-to-html");
  const [viewTab, setViewTab] = createSignal<"rendered" | "raw">("rendered");
  const [copied, setCopied] = createSignal(false);
  const [richCopied, setRichCopied] = createSignal(false);

  const sampleMd = `# TheBerry - Personal Desktop Suite

TheBerry is a powerful personal desktop suite designed for **efficiency**, **speed**, and **elegance**.

## Features
- **Clipboard History**: Intelligent instant search and clipboard daemon
- **App Launcher**: Instant shortcuts, scripts and app execution
- **Toolbox**: 17 built-in high-performance developer tools

### Code Example
\`\`\`typescript
interface UserConfig {
  theme: "dark" | "light" | "system";
  locale: "zh" | "en";
}
\`\`\`

> *Productivity begins with thoughtful simplicity.*
`;

  const [inputText, setInputText] = createSignal(sampleMd);

  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    hr: "---",
  });

  const getConvertedContent = () => {
    const text = inputText();
    if (!text.trim()) return "";

    try {
      if (direction() === "md-to-html") {
        const rawHtml = marked.parse(text) as string;
        return DOMPurify.sanitize(rawHtml);
      } else if (direction() === "html-to-md") {
        return turndownService.turndown(text);
      } else if (direction() === "md-to-text") {
        const html = marked.parse(text) as string;
        const temp = document.createElement("div");
        temp.innerHTML = DOMPurify.sanitize(html);
        return temp.textContent || temp.innerText || "";
      }
    } catch (e: any) {
      return String(e?.message || e);
    }
    return "";
  };

  const handleCopy = async () => {
    const content = getConvertedContent();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success(language() === "zh" ? "已复制到剪贴板" : "Copied to clipboard");
    } catch (e) {
      toastError(language() === "zh" ? "复制失败" : "Failed to copy", String(e));
    }
  };

  const handleCopyRichText = async () => {
    const text = inputText();
    if (!text.trim()) return;

    try {
      const html = DOMPurify.sanitize(marked.parse(text) as string);
      const plain = getConvertedContent();

      const blobHtml = new Blob([html], { type: "text/html" });
      const blobPlain = new Blob([plain], { type: "text/plain" });

      const clipboardItem = new ClipboardItem({
        "text/html": blobHtml,
        "text/plain": blobPlain,
      });

      await navigator.clipboard.write([clipboardItem]);
      setRichCopied(true);
      setTimeout(() => setRichCopied(false), 2000);
      success(
        language() === "zh" ? "富文本已复制" : "Rich text copied",
        language() === "zh"
          ? "可直接粘贴到 Word、邮件或微信，样式保持完整"
          : "Paste directly into Word, Outlook, or notes with styling intact"
      );
    } catch (e) {
      // Fallback plain copy if rich clipboard item fails
      handleCopy();
    }
  };

  const handleExport = async () => {
    const content = getConvertedContent();
    if (!content) return;

    try {
      const ext = direction() === "html-to-md" ? "md" : direction() === "md-to-text" ? "txt" : "html";
      const filePath = await save({
        filters: [
          {
            name: ext.toUpperCase(),
            extensions: [ext],
          },
        ],
        defaultPath: `the_berry_converted.${ext}`,
      });

      if (filePath) {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filePath.split(/[/\\]/).pop() || `export.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
        success(language() === "zh" ? "导出成功" : "Export successful", filePath);
      }
    } catch (e) {
      toastError(language() === "zh" ? "导出失败" : "Export failed", String(e));
    }
  };

  const handleSwap = () => {
    const currentResult = getConvertedContent();
    if (direction() === "md-to-html") {
      setDirection("html-to-md");
      setInputText(currentResult);
    } else {
      setDirection("md-to-html");
      setInputText(currentResult);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-foreground">
          {/* Header */}
          <div class="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <Type size={20} />
              </div>
              <div>
                <h3 class="text-base font-bold text-foreground">
                  {language() === "zh" ? "Markdown 转换与富文本" : "Markdown & Rich Text Converter"}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">
                  {language() === "zh"
                    ? "支持 Markdown、HTML 与纯文本无损互转，一键导出或复制到 Office / 邮件"
                    : "Bi-directional Markdown, HTML & plain text conversion with rich-text clipboard export"}
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

          {/* Direction & Action Controls Bar */}
          <div class="px-6 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <div class="inline-flex p-1 bg-secondary/50 rounded-xl border border-border text-xs font-medium">
                <button
                  onClick={() => setDirection("md-to-html")}
                  class={`px-3 py-1.5 rounded-lg transition-all ${
                    direction() === "md-to-html"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Markdown ➔ HTML
                </button>
                <button
                  onClick={() => setDirection("html-to-md")}
                  class={`px-3 py-1.5 rounded-lg transition-all ${
                    direction() === "html-to-md"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  HTML ➔ Markdown
                </button>
                <button
                  onClick={() => setDirection("md-to-text")}
                  class={`px-3 py-1.5 rounded-lg transition-all ${
                    direction() === "md-to-text"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {language() === "zh" ? "纯文本提取" : "To Plain Text"}
                </button>
              </div>

              <Show when={direction() !== "md-to-text"}>
                <button
                  onClick={handleSwap}
                  title={language() === "zh" ? "反转输入与输出" : "Swap input and output"}
                  class="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 transition-all"
                >
                  <ArrowRightLeft size={14} />
                </button>
              </Show>
            </div>

            {/* Right Action Buttons */}
            <div class="flex items-center gap-2">
              <Show when={direction() === "md-to-html"}>
                <div class="inline-flex p-0.5 bg-secondary/40 rounded-lg border border-border text-xs">
                  <button
                    onClick={() => setViewTab("rendered")}
                    class={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      viewTab() === "rendered"
                        ? "bg-background text-foreground font-medium shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye size={12} />
                    <span>{language() === "zh" ? "渲染预览" : "Preview"}</span>
                  </button>
                  <button
                    onClick={() => setViewTab("raw")}
                    class={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                      viewTab() === "raw"
                        ? "bg-background text-foreground font-medium shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code2 size={12} />
                    <span>{language() === "zh" ? "HTML代码" : "Raw HTML"}</span>
                  </button>
                </div>

                <button
                  onClick={handleCopyRichText}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-all shadow-xs"
                  title={language() === "zh" ? "复制富文本以直接粘贴到 Word、邮件等" : "Copy rich text for Word, Outlook, etc."}
                >
                  <Show when={richCopied()} fallback={<Sparkles size={13} />}>
                    <Check size={13} class="text-green-500" />
                  </Show>
                  <span>{richCopied() ? (language() === "zh" ? "已复制富文本" : "Rich Text Copied") : (language() === "zh" ? "复制富文本" : "Copy Rich Text")}</span>
                </button>
              </Show>

              <button
                onClick={handleCopy}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-all shadow-xs border border-border/60"
              >
                <Show when={copied()} fallback={<Copy size={13} />}>
                  <Check size={13} class="text-green-500" />
                </Show>
                <span>{copied() ? (language() === "zh" ? "已复制" : "Copied") : (language() === "zh" ? "复制代码" : "Copy Code")}</span>
              </button>

              <button
                onClick={handleExport}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-all shadow-xs border border-border/60"
              >
                <Download size={13} />
                <span>{language() === "zh" ? "导出文件" : "Export"}</span>
              </button>
            </div>
          </div>

          {/* Main Two-Pane Split Editor & Preview */}
          <div class="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border min-h-[400px] overflow-hidden">
            {/* Input Pane */}
            <div class="flex flex-col h-full overflow-hidden bg-background">
              <div class="px-4 py-2 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                <span class="font-semibold text-foreground">
                  {direction() === "md-to-html" || direction() === "md-to-text"
                    ? "Markdown " + (language() === "zh" ? "输入源" : "Input")
                    : "HTML " + (language() === "zh" ? "输入源" : "Input")}
                </span>
                <span class="text-[11px] font-mono">{inputText().length} {language() === "zh" ? "字符" : "chars"}</span>
              </div>
              <textarea
                value={inputText()}
                onInput={(e) => setInputText(e.currentTarget.value)}
                placeholder={
                  direction() === "html-to-md"
                    ? language() === "zh"
                      ? "在此粘贴或输入 HTML 代码..."
                      : "Paste or enter HTML here..."
                    : language() === "zh"
                    ? "在此输入或粘贴 Markdown 文本..."
                    : "Type or paste Markdown text here..."
                }
                class="flex-1 w-full p-4 bg-transparent outline-none resize-none font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:bg-primary/[0.02] transition-colors"
                spellcheck={false}
              />
            </div>

            {/* Output Pane */}
            <div class="flex flex-col h-full overflow-hidden bg-muted/5">
              <div class="px-4 py-2 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                <span class="font-semibold text-foreground">
                  {direction() === "html-to-md"
                    ? "Markdown " + (language() === "zh" ? "输出结果" : "Output")
                    : direction() === "md-to-text"
                    ? language() === "zh" ? "纯文本输出" : "Plain Text Output"
                    : viewTab() === "rendered"
                    ? language() === "zh" ? "实时渲染效果" : "Rendered Preview"
                    : "HTML " + (language() === "zh" ? "代码输出" : "Output")}
                </span>
                <span class="text-[11px] font-mono">{getConvertedContent().length} {language() === "zh" ? "字符" : "chars"}</span>
              </div>

              <div class="flex-1 p-4 overflow-auto">
                <Show
                  when={direction() === "md-to-html" && viewTab() === "rendered"}
                  fallback={
                    <pre class="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text break-words">
                      {getConvertedContent()}
                    </pre>
                  }
                >
                  <div
                    class="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-3"
                    innerHTML={getConvertedContent()}
                  />
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
