import { createSignal, Show } from "solid-js";
import { X, Braces, ArrowRightLeft, Copy, Check, Sparkles, CheckCircle2, AlertCircle } from "lucide-solid";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type DataFormat = "json" | "yaml";

export function StructuredDataModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError } = useToast();

  const [inputFormat, setInputFormat] = createSignal<DataFormat>("json");
  const [outputFormat, setOutputFormat] = createSignal<DataFormat>("yaml");
  const [inputText, setInputText] = createSignal(
    JSON.stringify(
      {
        name: "TheBerry",
        version: "0.1.10",
        features: ["clipboard", "launcher", "snippets", "file-search", "toolbox"],
        settings: {
          theme: "system",
          autostart: true,
        },
      },
      null,
      2
    )
  );
  const [outputText, setOutputText] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const handleConvert = () => {
    setErrorMessage(null);
    const text = inputText().trim();
    if (!text) {
      setOutputText("");
      return;
    }

    try {
      // 1. Parse input
      let parsed: any;
      if (inputFormat() === "json") {
        parsed = JSON.parse(text);
      } else if (inputFormat() === "yaml") {
        parsed = yamlLoad(text);
      }

      // 2. Format / Convert output
      let result = "";
      if (outputFormat() === "json") {
        result = JSON.stringify(parsed, null, 2);
      } else if (outputFormat() === "yaml") {
        result = yamlDump(parsed, { indent: 2 });
      }

      setOutputText(result);
      success(language() === "zh" ? "转换并格式化成功" : "Successfully converted & formatted");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setErrorMessage(msg);
      toastError(language() === "zh" ? "解析或转换错误" : "Parse or conversion error", msg);
    }
  };

  const swapFormats = () => {
    const prevIn = inputFormat();
    const prevOut = outputFormat();
    setInputFormat(prevOut);
    setOutputFormat(prevIn);
    if (outputText()) {
      setInputText(outputText());
      setOutputText("");
    }
  };

  const copyOutput = async () => {
    if (!outputText()) return;
    try {
      await navigator.clipboard.writeText(outputText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success(language() === "zh" ? "已复制输出内容" : "Copied output to clipboard");
    } catch {
      // ignore
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
        <div class="w-full max-w-5xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div class="flex items-center space-x-2.5">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <Braces size={20} />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-foreground">
                  {language() === "zh" ? "结构化数据转换与美化 (JSON / YAML)" : "Structured Data / Formatter"}
                </h3>
                <p class="text-[11px] text-muted-foreground">
                  {language() === "zh"
                    ? "实时语法校验、高保真美化与 JSON / YAML 相互无损转换"
                    : "Validate, beautify, and cross-convert between JSON and YAML in real time"}
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

          {/* Controls Bar */}
          <div class="px-5 py-3 border-b border-border flex items-center justify-between bg-secondary/30 flex-wrap gap-2.5">
            <div class="flex items-center gap-2">
              {/* Input format */}
              <div class="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setInputFormat("json")}
                  class={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    inputFormat() === "json"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => setInputFormat("yaml")}
                  class={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    inputFormat() === "yaml"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  YAML
                </button>
              </div>

              {/* Swap */}
              <button
                type="button"
                onClick={swapFormats}
                class="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                title={language() === "zh" ? "交换格式" : "Swap formats"}
              >
                <ArrowRightLeft size={14} />
              </button>

              {/* Output format */}
              <div class="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setOutputFormat("yaml")}
                  class={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    outputFormat() === "yaml"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  YAML
                </button>
                <button
                  type="button"
                  onClick={() => setOutputFormat("json")}
                  class={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    outputFormat() === "json"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConvert}
                class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Sparkles size={13} />
                <span>{language() === "zh" ? "转换并美化" : "Convert & Beautify"}</span>
              </button>
            </div>
          </div>

          {/* Editors Grid */}
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-[380px]">
            {/* Input Pane */}
            <div class="flex flex-col h-full space-y-1.5 min-h-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {language() === "zh" ? 输入 () : Input ()}
                </span>
                <button
                  type="button"
                  onClick={() => setInputText("")}
                  class="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  {language() === "zh" ? "清空" : "Clear"}
                </button>
              </div>
              <textarea
                value={inputText()}
                onInput={(e) => setInputText(e.currentTarget.value)}
                placeholder={language() === "zh" ? "在此输入或粘贴结构化数据..." : "Type or paste structured data here..."}
                class="w-full flex-1 p-3 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
              />
            </div>

            {/* Output Pane */}
            <div class="flex flex-col h-full space-y-1.5 min-h-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {language() === "zh" ? 输出 () : Output ()}
                </span>
                <Show when={outputText()}>
                  <button
                    type="button"
                    onClick={copyOutput}
                    class="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Show when={copied()} fallback={<Copy size={12} />}>
                      <Check size={12} class="text-emerald-500" />
                    </Show>
                    <span>{copied() ? language() === "zh" ? "已复制" : "Copied" : language() === "zh" ? "复制" : "Copy"}</span>
                  </button>
                </Show>
              </div>

              <div class="relative flex-1 min-h-0">
                <textarea
                  readOnly
                  value={outputText()}
                  placeholder={language() === "zh" ? "转换或校验结果将显示在此处..." : "Converted or formatted output will appear here..."}
                  class="w-full h-full p-3 bg-muted/20 border border-border rounded-xl text-xs font-mono text-foreground focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Error Banner */}
          <Show when={errorMessage()}>
            <div class="mx-5 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2.5 text-xs text-destructive">
              <AlertCircle size={16} class="flex-shrink-0 mt-0.5" />
              <div class="min-w-0 flex-1 font-mono text-[11px] break-all">{errorMessage()}</div>
            </div>
          </Show>

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
