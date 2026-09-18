import { Show } from "solid-js";
import { AIConfig } from "../../../types/goose";
import { useI18n } from "../../../context/I18nContext";
import { Sparkles, Settings } from "lucide-solid";

interface AISectionProps {
  aiConfig: () => AIConfig | null;
  onOpenModal: () => void;
}

export function AISection(props: AISectionProps) {
  const { t } = useI18n();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <Sparkles size={16} class="text-primary" />
          <span>{t("settings.ai_assistant")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.ai_desc")}
        </p>
      </div>

      <div class="p-4 bg-card border border-border rounded-xl space-y-3.5 shadow-xs">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground">Assistant Runtime Status</span>
          <Show when={props.aiConfig()}>
            <span class="text-[10px] px-2.5 py-0.5 rounded font-mono bg-primary/10 text-primary border border-primary/20">
              {props.aiConfig()?.active_provider.toUpperCase()} • {props.aiConfig()?.model} • {(props.aiConfig()?.request_format || "openai").toUpperCase()}
            </span>
          </Show>
        </div>

        <p class="text-xs text-muted-foreground leading-relaxed">
          Configure model providers (OpenAI, Anthropic Claude, Google Gemini, Ollama, DeepSeek, Groq, OpenRouter), custom API base URLs, custom prompts, and external Model Context Protocol (MCP) tool extensions.
        </p>

        <div class="pt-2 border-t border-border flex items-center justify-between">
          <span class="text-[11px] text-muted-foreground">
            {props.aiConfig()?.is_configured ? "Provider credentials configured" : "Setup provider key or local model"}
          </span>

          <button
            type="button"
            onClick={props.onOpenModal}
            class="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs active:scale-95"
          >
            <Settings size={13} />
            <span>{t("settings.configure")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
