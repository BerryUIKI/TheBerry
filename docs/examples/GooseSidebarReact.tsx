import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  Settings2,
  AlertCircle 
} from "lucide-react";

export interface GooseStatus {
  is_running: boolean;
  is_installed: boolean;
  binary_path: string | null;
  port: number | null;
  active_model: string | null;
  active_provider: string | null;
  error_message: string | null;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface GooseStreamChunk {
  session_id: string;
  message_id: string;
  delta: string;
  is_finished: boolean;
  error?: string;
}

interface GooseSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GooseSidebarReact: React.FC<GooseSidebarProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<GooseStatus | null>(null);
  const [sessionId] = useState(() => "session_" + Math.random().toString(36).substring(2, 9));
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll status and listen for stream events
  useEffect(() => {
    fetchStatus();

    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<GooseStreamChunk>("goose://stream-chunk", (event) => {
        const chunk = event.payload;
        if (chunk.session_id !== sessionId) return;

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === "assistant" && lastMsg.isStreaming) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + chunk.delta,
              isStreaming: !chunk.is_finished,
            };
            return updated;
          } else {
            return [
              ...prev,
              {
                id: chunk.message_id || Date.now().toString(),
                sender: "assistant",
                content: chunk.delta,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                isStreaming: !chunk.is_finished,
              },
            ];
          }
        });

        if (chunk.is_finished) {
          setIsGenerating(false);
        }
      });
    };

    setupListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [sessionId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchStatus = async () => {
    try {
      const res = await invoke<GooseStatus>("get_goose_status");
      setStatus(res);
    } catch (e) {
      console.error("Failed to fetch Goose status:", e);
    }
  };

  const handleToggleDaemon = async () => {
    try {
      if (status?.is_running) {
        await invoke("stop_goose_daemon");
      } else {
        await invoke("start_goose_daemon");
      }
      await fetchStatus();
    } catch (e) {
      console.error("Failed to toggle Goose daemon:", e);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isGenerating) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsGenerating(true);

    try {
      await invoke("send_goose_message", {
        payload: {
          session_id: sessionId,
          prompt: prompt,
        },
      });
    } catch (err: any) {
      setIsGenerating(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "system",
          content: `Error: ${err?.message || "Failed to communicate with Goose service."}`,
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

  return (
    <aside
      aria-label="Goose AI Assistant Drawer"
      className={`fixed top-9 right-0 bottom-0 w-96 bg-card border-l border-border shadow-2xl flex flex-col z-40 transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
      }`}
    >
      {/* Header */}
      <div className="h-12 border-b border-border px-3 flex items-center justify-between bg-muted/40 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-foreground">Goose AI</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  status?.is_running ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                }`}
                title={status?.is_running ? `Running on port ${status.port}` : "Offline"}
              />
            </div>
            <span className="text-[10px] text-muted-foreground block">
              {status?.is_running ? `Port ${status.port} • ${status.active_model || "Ready"}` : "Service Stopped"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleToggleDaemon}
            title={status?.is_running ? "Stop Goose Daemon" : "Start Goose Daemon"}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
              status?.is_running
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Power size={14} />
          </button>
          <button
            onClick={onClose}
            title="Close Assistant"
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground space-y-2 select-none">
            <Bot size={32} className="text-primary/60 animate-bounce" />
            <p className="text-xs font-medium text-foreground">How can Goose assist you today?</p>
            <p className="text-[11px] leading-relaxed">
              Ask coding questions, refactor snippets, analyze local files, or execute automated workflows.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1 ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center space-x-1 text-[10px] text-muted-foreground px-1">
                {msg.sender === "user" ? <User size={10} /> : <Bot size={10} />}
                <span>{msg.sender === "user" ? "You" : "Goose"}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`relative group rounded-lg px-3 py-2 text-xs max-w-[90%] break-words leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.sender === "system"
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-secondary text-secondary-foreground border border-border"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.sender === "assistant" && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-all shadow-sm"
                    title="Copy message"
                  >
                    {copiedId === msg.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSendMessage} className="p-2.5 border-t border-border bg-background/50 flex items-center space-x-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={status?.is_running ? "Type a prompt for Goose..." : "Goose service is stopped..."}
          disabled={!status?.is_running || isGenerating}
          className="flex-1 bg-secondary/60 border border-border/80 focus:border-primary rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isGenerating || !status?.is_running}
          className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
        >
          {isGenerating ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </form>
    </aside>
  );
};
