import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check, 
  RefreshCw, 
  Power, 
  Trash2,
  AlertCircle,
  ExternalLink,
  Settings,
} from "lucide-solid";
import { 
  getGooseStatus, 
  startGooseDaemon, 
  stopGooseDaemon, 
  sendGooseMessage, 
  onGooseStreamChunk,
  getAIConfig,
} from "../../services/goose";
import { GooseStatus, GooseChatMessage, GooseStreamChunk, AIConfig } from "../../types/goose";
import { GooseConfigModal } from "./GooseConfigModal";
import { useI18n } from "../../context/I18nContext";
import { MarkdownContent } from "../common/MarkdownContent";

interface GooseSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GooseSidebar(props: GooseSidebarProps) {
  const { t, language, assistantName } = useI18n();
  const [messages, setMessages] = createSignal<GooseChatMessage[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [status, setStatus] = createSignal<GooseStatus | null>(null);
  const [aiConfig, setAiConfig] = createSignal<AIConfig | null>(null);
  const [sessionId, setSessionId] = createSignal("sess_" + Math.random().toString(36).substring(2, 9));
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [isStarting, setIsStarting] = createSignal(false);
  const [showConfigModal, setShowConfigModal] = createSignal(false);

  let messagesEndRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const fetchStatusAndConfig = async () => {
    try {
      const [resStatus, resConfig] = await Promise.allSettled([
        getGooseStatus(),
        getAIConfig(),
      ]);
      if (resStatus.status === "fulfilled") setStatus(resStatus.value);
      if (resConfig.status === "fulfilled") setAiConfig(resConfig.value);
    } catch (e) {
      console.warn("Failed to fetch Goose status and AI config:", e);
    }
  };

  onMount(() => {
    fetchStatusAndConfig();

    let unlistenFn: (() => void) | null = null;
    onGooseStreamChunk((chunk: GooseStreamChunk) => {
      if (chunk.session_id !== sessionId()) return;

      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.sender === "assistant" && lastMsg.isStreaming) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastMsg,
            content: lastMsg.content + chunk.delta,
            isStreaming: !chunk.is_finished,
            error: chunk.error || null,
          };
          return updated;
        } else if (chunk.delta || chunk.error) {
          return [
            ...prev,
            {
              id: chunk.message_id || Date.now().toString(),
              sender: "assistant",
              content: chunk.delta,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isStreaming: !chunk.is_finished,
              error: chunk.error || null,
            },
          ];
        }
        return prev;
      });

      if (chunk.is_finished) {
        setIsGenerating(false);
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    onCleanup(() => {
      if (unlistenFn) unlistenFn();
    });
  });

  // Focus input when opened
  createEffect(() => {
    if (props.isOpen) {
      fetchStatusAndConfig();
      setTimeout(() => {
        inputRef?.focus();
        scrollToBottom();
      }, 100);
    }
  });

  // Auto scroll on new messages
  createEffect(() => {
    if (messages().length) {
      scrollToBottom();
    }
  });

  const scrollToBottom = () => {
    messagesEndRef?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e?: Event) => {
    if (e) e.preventDefault();
    const prompt = inputValue().trim();
    if (!prompt || isGenerating()) return;

    const userMessageId = Date.now().toString();
    const userMessage: GooseChatMessage = {
      id: userMessageId,
      sender: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsGenerating(true);

    // Placeholder for streaming assistant response
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: GooseChatMessage = {
      id: assistantMessageId,
      sender: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      await sendGooseMessage({
        session_id: sessionId(),
        prompt,
        model: aiConfig()?.model || status()?.active_model || undefined,
        provider: aiConfig()?.active_provider || status()?.active_provider || undefined,
      });
    } catch (err: any) {
      console.error("Failed to send prompt to AI engine:", err);
      setIsGenerating(false);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].sender === "assistant") {
          updated[lastIdx] = {
            ...updated[lastIdx],
            isStreaming: false,
            error: err.message || String(err),
          };
        }
        return updated;
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy message failed:", err);
    }
  };

  const handleToggleDaemon = async () => {
    setIsStarting(true);
    try {
      if (status()?.is_running) {
        await stopGooseDaemon();
      } else {
        await startGooseDaemon();
      }
      await fetchStatusAndConfig();
    } catch (e) {
      console.error("Daemon toggle error:", e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setSessionId("sess_" + Math.random().toString(36).substring(2, 9));
  };

  return (
    <>
      <aside
        aria-label="TheBerry AI Assistant Drawer"
        class={`fixed top-9 right-0 bottom-0 w-[420px] max-w-[calc(100vw-3rem)] bg-card border-l border-border shadow-2xl flex flex-col z-40 transition-all duration-300 ease-in-out ${
          props.isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div class="h-14 border-b border-border px-3.5 flex items-center justify-between bg-muted/40 flex-shrink-0 select-none">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-xl overflow-hidden shadow-sm ring-1 ring-border bg-black/10 flex-shrink-0 flex items-center justify-center">
              <img src="/berry.png" alt={assistantName()} class="w-full h-full object-cover" />
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold tracking-tight text-foreground">{assistantName()} AI</span>
                <span
                  class={`w-2 h-2 rounded-full transition-colors ${
                    status()?.is_running
                      ? "bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse"
                      : "bg-emerald-500/80"
                  }`}
                  title={status()?.is_running ? `Daemon Port ${status()?.port}` : "Direct LLM Ready"}
                />
              </div>
              <span class="text-[10px] text-muted-foreground block font-mono">
                {aiConfig()?.active_provider ? `${aiConfig()?.active_provider.toUpperCase()} • ${aiConfig()?.model}` : "Ready"}
              </span>
            </div>
          </div>

          <div class="flex items-center space-x-1">
            {/* Settings Modal Button */}
            <button
              onClick={() => setShowConfigModal(true)}
              title="Configure AI & User Profile"
              class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
            >
              <Settings size={14} />
            </button>

            {/* Clear Session */}
            <button
              onClick={handleClearHistory}
              title="Clear Chat History"
              class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
            >
              <Trash2 size={13} />
            </button>

            <div class="h-4 w-[1px] bg-border mx-0.5" />

            {/* Close Drawer */}
            <button
              onClick={props.onClose}
              title="Close Assistant (Esc)"
              class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-all active:scale-95"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div class="flex-1 overflow-y-auto p-3.5 space-y-4">
          {messages().length === 0 ? (
            <div class="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground space-y-3.5 select-none">
              <div class="w-18 h-18 rounded-2xl overflow-hidden shadow-md ring-1 ring-border bg-black/10 flex-shrink-0 flex items-center justify-center">
                <img src="/berry.png" alt={assistantName()} class="w-full h-full object-cover" />
              </div>
              <div class="space-y-1">
                <p class="text-sm font-bold text-foreground">{t("ai.drawer_title")}</p>
                <p class="text-xs leading-relaxed max-w-[280px]">
                  {t("ai.subtitle")}
                </p>
              </div>

              <div class="pt-2 flex items-center space-x-2">
                <button
                  onClick={() => setShowConfigModal(true)}
                  class="px-3.5 py-1.5 rounded-xl bg-secondary border border-border text-foreground text-xs font-medium hover:bg-secondary/80 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                >
                  <Settings size={13} class="text-primary" />
                  <span>{t("ai.configure_provider")}</span>
                </button>
              </div>
            </div>
          ) : (
            <For each={messages()}>
              {(msg) => (
                <div
                  class={`flex items-start space-x-2.5 w-full min-w-0 ${
                    msg.sender === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <div class="flex-shrink-0 mt-0.5">
                    {msg.sender === "user" ? (
                      <div class="w-7 h-7 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center shadow-xs ring-1 ring-border">
                        <Show when={aiConfig()?.user_avatar} fallback={<User size={14} />}>
                          <img
                            src={aiConfig()!.user_avatar}
                            alt={aiConfig()?.user_name || "You"}
                            class="w-full h-full object-cover"
                          />
                        </Show>
                      </div>
                    ) : (
                      <div class="w-7 h-7 rounded-full overflow-hidden shadow-xs ring-1 ring-border bg-black/10 flex items-center justify-center">
                        <img src="/berry.png" alt={assistantName()} class="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  {/* Bubble & Metadata */}
                  <div
                    class={`flex flex-col space-y-1 max-w-[calc(100%-2.5rem)] min-w-0 ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div class="flex items-center space-x-1.5 text-[10px] text-muted-foreground px-0.5">
                      <span class="font-semibold text-foreground">
                        {msg.sender === "user" ? (aiConfig()?.user_name || "You") : assistantName()}
                      </span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                      <Show when={msg.content && !msg.isStreaming}>
                        <span>•</span>
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          class="text-[10px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center space-x-0.5"
                          title="Copy message text"
                        >
                          {copiedId() === msg.id ? (
                            <Check size={10} class="text-emerald-500" />
                          ) : (
                            <Copy size={10} />
                          )}
                          <span>{copiedId() === msg.id ? "Copied" : "Copy"}</span>
                        </button>
                      </Show>
                    </div>

                    <div
                      class={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs min-w-0 max-w-full overflow-hidden ${
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground shadow-sm rounded-tr-xs"
                          : msg.sender === "system"
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-secondary text-secondary-foreground border border-border rounded-tl-xs"
                      }`}
                    >
                      {msg.sender === "user" ? (
                        <div class="whitespace-pre-wrap font-sans break-words [overflow-wrap:anywhere] select-text">
                          {msg.content}
                        </div>
                      ) : (
                        <div class="min-w-0 select-text">
                          <MarkdownContent content={msg.content} />
                        </div>
                      )}

                      <Show when={msg.isStreaming}>
                        <span class="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                      </Show>

                      <Show when={msg.error}>
                        <div class="mt-2 p-2 bg-destructive/15 border border-destructive/30 rounded-lg text-destructive text-[11px] flex items-start space-x-1.5 break-words [overflow-wrap:anywhere]">
                          <AlertCircle size={13} class="flex-shrink-0 mt-0.5" />
                          <span>{msg.error}</span>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              )}
            </For>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div class="p-3 border-t border-border bg-muted/20 flex-shrink-0">
          <form onSubmit={handleSendMessage} class="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue()}
              onInput={(e) => setInputValue(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                aiConfig()?.model
                  ? t("ai.placeholder", { model: aiConfig()!.model })
                  : t("ai.placeholder_generic")
              }
              disabled={isGenerating()}
              class="flex-1 bg-background border border-input rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 transition-all shadow-inner"
            />

            <button
              type="submit"
              disabled={!inputValue().trim() || isGenerating()}
              title="Send Message (Enter)"
              class="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center shadow-sm active:scale-95"
            >
              {isGenerating() ? (
                <RefreshCw size={14} class="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </form>

          <div class="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/70 px-1">
            <span>
              {language() === "zh" ? "按 " : "Press "}
              <kbd class="px-1 py-0.2 rounded bg-muted font-mono">Enter</kbd>
              {language() === "zh" ? " 发送" : " to send"}
            </span>
            <span>
              {assistantName()} AI •{" "}
              <span
                class="text-primary hover:underline cursor-pointer"
                onClick={() => setShowConfigModal(true)}
              >
                {t("ai.settings_link")}
              </span>
            </span>
          </div>
        </div>
      </aside>

      {/* Embedded Configuration Modal */}
      <GooseConfigModal
        isOpen={showConfigModal()}
        onClose={() => {
          setShowConfigModal(false);
          fetchStatusAndConfig();
        }}
      />
    </>
  );
}
