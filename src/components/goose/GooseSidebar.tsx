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

interface GooseSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GooseSidebar(props: GooseSidebarProps) {
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
        <div class="h-13 border-b border-border px-3.5 flex items-center justify-between bg-muted/40 flex-shrink-0 select-none">
          <div class="flex items-center space-x-2.5">
            <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center p-0.5 shadow-sm ring-1 ring-primary/30 overflow-hidden">
              <img src="/berry.png" alt="TheBerry" class="w-6 h-6 object-contain" />
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-bold tracking-tight text-foreground">TheBerry AI</span>
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
              title="Configure AI & Providers"
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
        <div class="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          {messages().length === 0 ? (
            <div class="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground space-y-3 select-none">
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shadow-inner ring-1 ring-primary/20 p-1">
                <img src="/berry.png" alt="TheBerry" class="w-10 h-10 object-contain" />
              </div>
              <div class="space-y-1">
                <p class="text-xs font-bold text-foreground">TheBerry AI Assistant</p>
                <p class="text-[11px] leading-relaxed max-w-[280px]">
                  Ask coding questions, refactor snippets, summarize files, or automate desktop operations.
                </p>
              </div>

              <div class="pt-2 flex items-center space-x-2">
                <button
                  onClick={() => setShowConfigModal(true)}
                  class="px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs font-medium hover:bg-secondary/80 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                >
                  <Settings size={13} class="text-primary" />
                  <span>Configure Provider</span>
                </button>
              </div>
            </div>
          ) : (
            <For each={messages()}>
              {(msg) => (
                <div
                  class={`flex flex-col space-y-1 ${
                    msg.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div class="flex items-center space-x-1.5 text-[10px] text-muted-foreground px-1">
                    {msg.sender === "user" ? (
                      <div class="flex items-center space-x-1">
                        <User size={10} />
                        <span class="font-semibold text-foreground">You</span>
                      </div>
                    ) : (
                      <div class="flex items-center space-x-1.5">
                        <img src="/berry.png" alt="TheBerry" class="w-3.5 h-3.5 rounded-full object-contain" />
                        <span class="font-semibold text-primary">TheBerry</span>
                      </div>
                    )}
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    class={`relative group rounded-xl px-3.5 py-2.5 text-xs max-w-[94%] break-words leading-relaxed shadow-xs ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground shadow-sm rounded-tr-xs"
                        : msg.sender === "system"
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-secondary text-secondary-foreground border border-border rounded-tl-xs"
                    }`}
                  >
                    <div class="whitespace-pre-wrap font-sans">{msg.content}</div>

                    <Show when={msg.isStreaming}>
                      <span class="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                    </Show>

                    <Show when={msg.error}>
                      <div class="mt-2 p-2 bg-destructive/15 border border-destructive/30 rounded text-destructive text-[11px] flex items-start space-x-1.5">
                        <AlertCircle size={13} class="flex-shrink-0 mt-0.5" />
                        <span>{msg.error}</span>
                      </div>
                    </Show>

                    <Show when={msg.content && !msg.isStreaming}>
                      <div
                        class={`absolute -bottom-6 ${
                          msg.sender === "user" ? "right-1" : "left-1"
                        } opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 z-10`}
                      >
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          title="Copy response"
                          class="p-1 rounded bg-background border border-border text-muted-foreground hover:text-foreground text-[10px] shadow-sm flex items-center space-x-0.5"
                        >
                          {copiedId() === msg.id ? (
                            <Check size={10} class="text-emerald-500" />
                          ) : (
                            <Copy size={10} />
                          )}
                          <span>{copiedId() === msg.id ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </Show>
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
                  ? `Ask TheBerry (${aiConfig()?.model})...`
                  : "Ask TheBerry anything..."
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
            <span>Press <kbd class="px-1 py-0.2 rounded bg-muted font-mono">Enter</kbd> to send</span>
            <span>TheBerry AI • <span class="text-primary hover:underline cursor-pointer" onClick={() => setShowConfigModal(true)}>Settings</span></span>
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
