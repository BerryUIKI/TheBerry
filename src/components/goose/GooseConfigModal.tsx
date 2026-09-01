import { createSignal, onMount, For, Show } from "solid-js";
import { AIConfig, CustomMcpServer } from "../../types/goose";
import { getAIConfig, saveAIConfig } from "../../services/goose";
import { useToast } from "../../context/ToastContext";
import {
  Settings,
  X,
  Key,
  Sliders,
  Puzzle,
  Cpu,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ExternalLink,
  Check,
} from "lucide-solid";

interface ProviderPreset {
  id: AIConfig["active_provider"];
  name: string;
  defaultBaseUrl: string;
  defaultRequestFormat: AIConfig["request_format"];
  defaultModel: string;
  models: string[];
  requiresApiKey: boolean;
  helpUrl: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultRequestFormat: "openai",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4-turbo"],
    requiresApiKey: true,
    helpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultRequestFormat: "anthropic",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    requiresApiKey: true,
    helpUrl: "https://console.anthropic.com/",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultRequestFormat: "openai",
    defaultModel: "gemini-1.5-pro",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    requiresApiKey: true,
    helpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "ollama",
    name: "Ollama (Local Models)",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultRequestFormat: "ollama",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5-coder", "deepseek-r1", "mistral", "phi3"],
    requiresApiKey: false,
    helpUrl: "https://ollama.com",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultRequestFormat: "openai",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    requiresApiKey: true,
    helpUrl: "https://platform.deepseek.com",
  },
  {
    id: "groq",
    name: "Groq Cloud (Fast)",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultRequestFormat: "openai",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    requiresApiKey: true,
    helpUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultRequestFormat: "openai",
    defaultModel: "auto",
    models: ["auto", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct", "google/gemini-pro-1.5"],
    requiresApiKey: true,
    helpUrl: "https://openrouter.ai/keys",
  },
  {
    id: "custom",
    name: "Custom API Endpoint",
    defaultBaseUrl: "http://localhost:8000/v1/chat/completions",
    defaultRequestFormat: "custom",
    defaultModel: "default",
    models: ["default"],
    requiresApiKey: false,
    helpUrl: "https://github.com/aaif-goose/goose",
  },
];

export function GooseConfigModal(props: { isOpen: boolean; onClose: () => void }) {
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = createSignal<"provider" | "params" | "extensions" | "daemon">("provider");
  const [showApiKey, setShowApiKey] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  // Form State
  const [config, setConfig] = createSignal<AIConfig>({
    active_provider: "openai",
    request_format: "openai",
    api_key: "",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o",
    temperature: 0.7,
    max_tokens: 4096,
    system_prompt: "You are TheBerry, an intelligent, helpful, and concise AI desktop assistant integrated into TheBerry utility suite.",
    enable_developer_tools: true,
    enable_web_fetch: true,
    custom_mcp_servers: [],
    goose_binary_path: "",
    auto_start_daemon: false,
  });

  // MCP Server form input
  const [mcpName, setMcpName] = createSignal("");
  const [mcpCommand, setMcpCommand] = createSignal("");
  const [mcpArgs, setMcpArgs] = createSignal("");

  const loadConfig = async () => {
    try {
      const cfg = await getAIConfig();
      if (cfg) {
        setConfig({
          ...cfg,
          request_format: cfg.request_format || "openai",
        });
      }
    } catch (e) {
      console.warn("Failed to load AI configuration:", e);
    }
  };

  onMount(() => {
    loadConfig();
  });

  const handleProviderChange = (providerId: AIConfig["active_provider"]) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
    if (!preset) return;

    setConfig((prev) => ({
      ...prev,
      active_provider: providerId,
      request_format: preset.defaultRequestFormat,
      base_url: preset.defaultBaseUrl,
      model: preset.defaultModel,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAIConfig(config());
      success("AI Configuration Saved", `Active model set to ${config().model} (${config().active_provider})`);
      props.onClose();
    } catch (err: any) {
      error("Failed to Save AI Config", err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMcpServer = () => {
    if (!mcpName().trim() || !mcpCommand().trim()) return;
    const newServer: CustomMcpServer = {
      name: mcpName().trim(),
      command: mcpCommand().trim(),
      args: mcpArgs() ? mcpArgs().split(" ").filter(Boolean) : [],
      env: {},
    };
    setConfig((prev) => ({
      ...prev,
      custom_mcp_servers: [...prev.custom_mcp_servers, newServer],
    }));
    setMcpName("");
    setMcpCommand("");
    setMcpArgs("");
  };

  const handleDeleteMcpServer = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      custom_mcp_servers: prev.custom_mcp_servers.filter((_, i) => i !== index),
    }));
  };

  const resolvedEndpointPreview = () => {
    const raw = config().base_url.trim();
    const fmt = config().request_format || "openai";
    const mdl = config().model || "default";

    if (fmt === "custom") return raw || "http://localhost:8000/v1/chat/completions";
    if (fmt === "anthropic") {
      return raw ? (raw.endsWith("/messages") ? raw : `${raw.replace(/\/+$/, "")}/messages`) : "https://api.anthropic.com/v1/messages";
    }
    if (fmt === "gemini") {
      return raw ? (raw.includes("streamGenerateContent") ? raw : `${raw.replace(/\/+$/, "")}/models/${mdl}:streamGenerateContent`) : `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:streamGenerateContent`;
    }
    if (fmt === "ollama") {
      return raw ? (raw.endsWith("/api/chat") || raw.endsWith("/chat/completions") ? raw : `${raw.replace(/\/+$/, "")}/api/chat`) : "http://localhost:11434/api/chat";
    }
    // OpenAI format
    return raw ? (raw.endsWith("/chat/completions") ? raw : `${raw.replace(/\/+$/, "")}/chat/completions`) : "https://api.openai.com/v1/chat/completions";
  };

  const currentPreset = () => PROVIDER_PRESETS.find((p) => p.id === config().active_provider) || PROVIDER_PRESETS[0];

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          class="bg-card border border-border rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        >
          {/* Modal Header */}
          <div class="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl overflow-hidden shadow-sm ring-1 ring-border bg-black/10 flex items-center justify-center flex-shrink-0">
                <img src="/berry.png" alt="TheBerry" class="w-full h-full object-cover" />
              </div>
              <div>
                <h2 class="text-sm font-bold text-foreground">TheBerry AI & Goose Settings</h2>
                <p class="text-[11px] text-muted-foreground">Configure LLM providers, model parameters, and MCP tools</p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div class="flex items-center space-x-1 px-4 py-2 border-b border-border bg-muted/20 text-xs">
            <button
              onClick={() => setActiveTab("provider")}
              class={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium transition-all ${
                activeTab() === "provider"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Key size={13} />
              <span>Providers & Keys</span>
            </button>

            <button
              onClick={() => setActiveTab("params")}
              class={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium transition-all ${
                activeTab() === "params"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Sliders size={13} />
              <span>Parameters</span>
            </button>

            <button
              onClick={() => setActiveTab("extensions")}
              class={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium transition-all ${
                activeTab() === "extensions"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Puzzle size={13} />
              <span>MCP & Tools</span>
            </button>

            <button
              onClick={() => setActiveTab("daemon")}
              class={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium transition-all ${
                activeTab() === "daemon"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Cpu size={13} />
              <span>Goose Daemon</span>
            </button>
          </div>

          {/* Tab Contents */}
          <div class="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* 1. Providers & Keys */}
            <Show when={activeTab() === "provider"}>
              <div class="space-y-4">
                {/* Active Provider Selector */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground flex items-center justify-between">
                    <span>Model Provider</span>
                    <a
                      href={currentPreset().helpUrl}
                      target="_blank"
                      rel="noreferrer"
                      class="text-[11px] text-primary hover:underline flex items-center space-x-1"
                    >
                      <span>Get API Key</span>
                      <ExternalLink size={11} />
                    </a>
                  </label>
                  <select
                    value={config().active_provider}
                    onChange={(e) => handleProviderChange(e.currentTarget.value as any)}
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <For each={PROVIDER_PRESETS}>
                      {(p) => <option value={p.id}>{p.name}</option>}
                    </For>
                  </select>
                </div>

                {/* API Request Format / Protocol Selector */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground flex items-center justify-between">
                    <span>API Protocol / Request Format (请求格式)</span>
                    <span class="text-[10px] text-muted-foreground">Controls endpoint payload schema</span>
                  </label>
                  <select
                    value={config().request_format}
                    onChange={(e) => setConfig({ ...config(), request_format: e.currentTarget.value as any })}
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="openai">OpenAI Chat API (POST /chat/completions)</option>
                    <option value="anthropic">Anthropic Messages API (POST /v1/messages)</option>
                    <option value="gemini">Google Gemini Native API (POST :streamGenerateContent)</option>
                    <option value="ollama">Ollama Native API (POST /api/chat)</option>
                    <option value="custom">Custom / Raw Endpoint (Exact URL as entered)</option>
                  </select>
                </div>

                {/* API Key */}
                <Show when={currentPreset().requiresApiKey || config().request_format === "anthropic" || config().request_format === "openai"}>
                  <div class="space-y-1.5">
                    <label class="font-semibold text-foreground flex items-center justify-between">
                      <span>API Key</span>
                      <span class="text-[10px] text-muted-foreground">Stored securely on local device</span>
                    </label>
                    <div class="relative">
                      <input
                        type={showApiKey() ? "text" : "password"}
                        value={config().api_key}
                        onInput={(e) => setConfig({ ...config(), api_key: e.currentTarget.value })}
                        placeholder={`Enter your ${currentPreset().name} API Key...`}
                        class="w-full pl-3 pr-10 py-2 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey())}
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        {showApiKey() ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </Show>

                {/* Base URL */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground flex items-center justify-between">
                    <span>API Base URL / Endpoint</span>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config(), base_url: currentPreset().defaultBaseUrl })}
                      class="text-[10px] text-primary hover:underline flex items-center space-x-1"
                    >
                      <RotateCcw size={10} />
                      <span>Reset to default</span>
                    </button>
                  </label>
                  <input
                    type="text"
                    value={config().base_url}
                    onInput={(e) => setConfig({ ...config(), base_url: e.currentTarget.value })}
                    placeholder={currentPreset().defaultBaseUrl}
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div class="p-2 rounded bg-muted/40 border border-border/50 text-[10px] space-y-0.5">
                    <span class="font-semibold text-foreground block">Resolved Request Target (免 404 智能解析):</span>
                    <span class="font-mono text-primary break-all block">{resolvedEndpointPreview()}</span>
                  </div>
                </div>

                {/* Model Selector & Presets */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground">Model Identifier</label>
                  <input
                    type="text"
                    value={config().model}
                    onInput={(e) => setConfig({ ...config(), model: e.currentTarget.value })}
                    placeholder="e.g. gpt-4o, llama3.2, claude-3-5-sonnet"
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {/* Model Quick Chips */}
                  <div class="flex flex-wrap gap-1.5 pt-1">
                    <For each={currentPreset().models}>
                      {(m) => (
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config(), model: m })}
                          class={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                            config().model === m
                              ? "bg-primary/10 border-primary text-primary font-semibold"
                              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {m}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>

            {/* 2. Parameters */}
            <Show when={activeTab() === "params"}>
              <div class="space-y-4">
                {/* Temperature */}
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="font-semibold text-foreground">Temperature: {config().temperature}</label>
                    <span class="text-[11px] text-muted-foreground">
                      {config().temperature < 0.3
                        ? "Precise & Deterministic"
                        : config().temperature > 1.0
                        ? "Creative & Diverse"
                        : "Balanced"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={config().temperature}
                    onInput={(e) => setConfig({ ...config(), temperature: parseFloat(e.currentTarget.value) })}
                    class="w-full accent-primary"
                  />
                </div>

                {/* Max Tokens */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground">Max Output Tokens</label>
                  <input
                    type="number"
                    min="256"
                    max="32768"
                    step="256"
                    value={config().max_tokens}
                    onInput={(e) => setConfig({ ...config(), max_tokens: parseInt(e.currentTarget.value) || 4096 })}
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* System Prompt */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground">System Persona / Instructions</label>
                  <textarea
                    rows={4}
                    value={config().system_prompt}
                    onInput={(e) => setConfig({ ...config(), system_prompt: e.currentTarget.value })}
                    class="w-full p-2.5 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            </Show>

            {/* 3. Extensions & MCP */}
            <Show when={activeTab() === "extensions"}>
              <div class="space-y-4">
                <div class="space-y-2">
                  <h3 class="font-semibold text-foreground">Built-in MCP Extensions (Goose)</h3>
                  <div class="space-y-2">
                    <label class="flex items-center space-x-2.5 p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config().enable_developer_tools}
                        onChange={(e) => setConfig({ ...config(), enable_developer_tools: e.currentTarget.checked })}
                        class="rounded"
                      />
                      <div>
                        <p class="font-medium text-foreground">Developer Tools</p>
                        <p class="text-[11px] text-muted-foreground">Enables filesystem inspection, editing, and shell automation</p>
                      </div>
                    </label>

                    <label class="flex items-center space-x-2.5 p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config().enable_web_fetch}
                        onChange={(e) => setConfig({ ...config(), enable_web_fetch: e.currentTarget.checked })}
                        class="rounded"
                      />
                      <div>
                        <p class="font-medium text-foreground">Web Fetch & Search</p>
                        <p class="text-[11px] text-muted-foreground">Allows fetching URL contents and API lookups</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Custom MCP Servers */}
                <div class="space-y-3 pt-2 border-t border-border">
                  <h3 class="font-semibold text-foreground">Custom MCP Servers</h3>
                  <div class="space-y-2">
                    <For each={config().custom_mcp_servers}>
                      {(srv, idx) => (
                        <div class="flex items-center justify-between p-2.5 border border-border rounded-lg bg-background">
                          <div>
                            <p class="font-medium text-foreground">{srv.name}</p>
                            <p class="text-[11px] text-muted-foreground font-mono">{srv.command} {srv.args.join(" ")}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteMcpServer(idx())}
                            class="text-destructive hover:bg-destructive/10 p-1.5 rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </For>
                  </div>

                  {/* Add MCP Form */}
                  <div class="p-3 border border-dashed border-border rounded-lg space-y-2 bg-muted/20">
                    <p class="font-medium text-muted-foreground">Add Custom Server</p>
                    <div class="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Server Name (e.g. SQLite)"
                        value={mcpName()}
                        onInput={(e) => setMcpName(e.currentTarget.value)}
                        class="px-2.5 py-1.5 bg-background border border-input rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Executable (e.g. npx, uvx)"
                        value={mcpCommand()}
                        onInput={(e) => setMcpCommand(e.currentTarget.value)}
                        class="px-2.5 py-1.5 bg-background border border-input rounded text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Arguments (e.g. -y @modelcontextprotocol/server-sqlite --db /path)"
                      value={mcpArgs()}
                      onInput={(e) => setMcpArgs(e.currentTarget.value)}
                      class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddMcpServer}
                      class="px-3 py-1 bg-secondary hover:bg-secondary/80 text-foreground rounded text-xs flex items-center space-x-1 font-medium"
                    >
                      <Plus size={12} />
                      <span>Add MCP Server</span>
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* 4. Daemon & CLI */}
            <Show when={activeTab() === "daemon"}>
              <div class="space-y-4">
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground">Goose Binary Path Override</label>
                  <input
                    type="text"
                    value={config().goose_binary_path}
                    onInput={(e) => setConfig({ ...config(), goose_binary_path: e.currentTarget.value })}
                    placeholder="Leave blank for auto-discovery (PATH, Cargo, LocalAppData)"
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <label class="flex items-center space-x-2.5 p-2.5 border border-border rounded-lg bg-secondary/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config().auto_start_daemon}
                    onChange={(e) => setConfig({ ...config(), auto_start_daemon: e.currentTarget.checked })}
                    class="rounded"
                  />
                  <div>
                    <p class="font-medium text-foreground">Auto-start Goose daemon on launch</p>
                    <p class="text-[11px] text-muted-foreground">Automatically binds an ephemeral port and starts `goose serve`</p>
                  </div>
                </label>
              </div>
            </Show>
          </div>

          {/* Modal Footer */}
          <div class="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/30">
            <div class="flex items-center space-x-2 text-[11px] text-muted-foreground">
              <Check size={13} class="text-primary" />
              <span>Changes apply instantly to live chat</span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                type="button"
                onClick={props.onClose}
                class="px-3.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving()}
                onClick={handleSave}
                class="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors flex items-center space-x-1.5 font-medium shadow-sm disabled:opacity-50"
              >
                <Save size={13} />
                <span>{saving() ? "Saving..." : "Save Settings"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
