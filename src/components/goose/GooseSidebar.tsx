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
  ExternalLink
} from "lucide-solid";
import { 
  getGooseStatus, 
  startGooseDaemon, 
  stopGooseDaemon, 
  sendGooseMessage, 
  onGooseStreamChunk 
} from "../../services/goose";
import { GooseStatus, GooseChatMessage, GooseStreamChunk } from "../../types/goose";

interface GooseSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GooseSidebar(props: GooseSidebarProps) {
  const [messages, setMessages] = createSignal<GooseChatMessage[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [status, setStatus] = createSignal<GooseStatus | null>(null);
  const [sessionId, setSessionId] = createSignal("sess_" + Math.random().toString(36).substring(2, 9));
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [isStarting, setIsStarting] = createSignal(false);

  let messagesEndRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const fetchStatus = async () => {
    try {
      const res = await getGooseStatus();
      setStatus(res);
    } catch (e) {
      console.warn("Failed to fetch Goose status:", e);
    }
  };

  onMount(() => {
    fetchStatus();

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
      fetchStatus();
      setTimeout(() => inputRef?.focus(), 150);
    }
  });

  // Auto-scroll to bottom on message change
  createEffect(() => {
    messages();
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  });

  const handleToggleDaemon = async () => {
    setIsStarting(true);
    try {
      if (status()?.is_running) {
        await stopGooseDaemon();
      } else {
        await startGooseDaemon();
      }
      await fetchStatus();
    } catch (e: any) {
      console.error("Failed to toggle Goose daemon:", e);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "system",
          content: `Service Error: ${e?.message || e}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = async (e?: Event) => {
    if (e) e.preventDefault();
    const prompt = inputValue().trim();
    if (!prompt || isGenerating()) return;

    const userMsg: GooseChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsGenerating(true);

    try {
      await sendGooseMessage({
        session_id: sessionId(),
        prompt: prompt,
      });
    } catch (err: any) {
      setIsGenerating(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "system",
          content: `Communication Error: ${err?.message || err}. Ensure Goose is running.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([]);
    setSessionId("sess_" + Math.random().toString(36).substring(2, 9));
  };

  return (
    <aside
      aria-label="Goose AI Assistant Drawer"
      class={`fixed top-9 right-0 bottom-0 w-[400px] max-w-[calc(100vw-3rem)] bg-card border-l border-border shadow-2xl flex flex-col z-40 transition-all duration-300 ease-in-out ${
        props.isOpen
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      {/* Header */}
      <div class="h-12 border-b border-border px-3.5 flex items-center justify-between bg-muted/40 flex-shrink-0 select-none">
        <div class="flex items-center space-x-2.5">
          <div class="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
            <Sparkles size={15} />
          </div>
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="text-xs font-bold tracking-tight text-foreground">Goose AI Assistant</span>
              <span
                class={`w-2 h-2 rounded-full transition-colors ${
                  status()?.is_running
                    ? "bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse"
                    : "bg-muted-foreground/40"
                }`}
                title={status()?.is_running ? `Running on port ${status()?.port}` : "Offline"}
              />
            </div>
            <span class="text-[10px] text-muted-foreground block font-mono">
              {status()?.is_running
                ? `Port ${status()?.port} • ${status()?.active_model || "Ready"}`
                : status()?.is_installed
                ? "Service Standby (Click Power to Start)"
                : "Goose binary not detected"}
            </span>
          </div>
        </div>

        <div class="flex items-center space-x-1">
          {/* Clear Session */}
          <button
            onClick={handleClearHistory}
            title="Clear Chat History"
            class="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          >
            <Trash2 size={13} />
          </button>

          {/* Toggle Power */}
          <button
            onClick={handleToggleDaemon}
            disabled={isStarting()}
            title={status()?.is_running ? "Stop Goose Daemon" : "Start Goose Daemon"}
            class={`w-7 h-7 flex items-center justify-center rounded text-xs transition-all active:scale-95 ${
              status()?.is_running
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {isStarting() ? (
              <RefreshCw size={13} class="animate-spin text-primary" />
            ) : (
              <Power size={13} />
            )}
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
      <div class="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages().length === 0 ? (
          <div class="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground space-y-3 select-none">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Bot size={26} class="animate-bounce" />
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold text-foreground">aaif-goose AI Integration</p>
              <p class="text-[11px] leading-relaxed max-w-[260px]">
                Ask coding questions, refactor snippets, batch automate file operations, or execute tool tasks.
              </p>
            </div>

            <Show when={!status()?.is_running}>
              <button
                onClick={handleToggleDaemon}
                disabled={isStarting()}
                class="mt-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
              >
                {isStarting() ? (
                  <RefreshCw size={12} class="animate-spin" />
                ) : (
                  <Power size={12} />
                )}
                <span>Launch Goose Daemon</span>
              </button>
            </Show>
          </div>
        ) : (
          <For each={messages()}>
            {(msg) => (
              <div
                class={`flex flex-col space-y-1 ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div class="flex items-center space-x-1 text-[10px] text-muted-foreground px-1">
                  {msg.sender === "user" ? <User size={10} /> : <Bot size={10} />}
                  <span class="font-medium">{msg.sender === "user" ? "You" : "Goose"}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  class={`relative group rounded-lg px-3 py-2 text-xs max-w-[92%] break-words leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : msg.sender === "system"
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-secondary text-secondary-foreground border border-border shadow-sm"
                  }`}
                >
                  <div class="whitespace-pre-wrap font-sans">{msg.content}</div>

                  <Show when={msg.isStreaming}>
                    <span class="inline-block w-1.5 h-3 ml-1 bg-primary animate-pulse" />
                  </Show>

                  <Show when={msg.sender === "assistant" && msg.content}>
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-all shadow-sm"
                      title="Copy response"
                    >
                      {copiedId() === msg.id ? (
                        <Check size={11} class="text-emerald-500" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSendMessage}
        class="p-2.5 border-t border-border bg-background/60 backdrop-blur flex items-center space-x-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue()}
          onInput={(e) => setInputValue(e.currentTarget.value)}
          placeholder={
            status()?.is_running
              ? "Ask Goose a question or task..."
              : "Type prompt (auto-starts Goose daemon)..."
          }
          disabled={isGenerating()}
          class="flex-1 bg-secondary/60 border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputValue().trim() || isGenerating()}
          class="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0 active:scale-95 shadow-sm"
          title="Send Prompt (Enter)"
        >
          {isGenerating() ? (
            <RefreshCw size={13} class="animate-spin" />
          ) : (
            <Send size={13} />
          )}
        </button>
      </form>
    </aside>
  );
}
