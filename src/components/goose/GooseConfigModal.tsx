import { createSignal, onMount, For, Show } from "solid-js";
import { AIConfig, CustomMcpServer } from "../../types/goose";
import { getAIConfig, saveAIConfig, fetchProviderModels } from "../../services/goose";
import { useToast } from "../../context/ToastContext";
import { useI18n } from "../../context/I18nContext";
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
  User,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-solid";

import { PROVIDER_PRESETS, ProviderPreset } from "./presets";

export function GooseConfigModal(props: { isOpen: boolean; onClose: () => void }) {
  const { success, error } = useToast();
  const { setLanguage: setGlobalLanguage } = useI18n();
  const [activeTab, setActiveTab] = createSignal<"provider" | "params" | "profile" | "extensions" | "daemon">("provider");
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
    language: "en",
    user_name: "You",
    user_avatar: "",
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

  // Live Model Fetching
  const [fetchedModels, setFetchedModels] = createSignal<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = createSignal(false);
  const [initialConfig, setInitialConfig] = createSignal<AIConfig | null>(null);

  const loadConfig = async () => {
    try {
      const cfg = await getAIConfig();
      if (cfg) {
        const fullCfg: AIConfig = {
          ...cfg,
          request_format: cfg.request_format || "openai",
          language: cfg.language || "en",
          user_name: cfg.user_name || "You",
          user_avatar: cfg.user_avatar || "",
        };
        setConfig(fullCfg);
        setInitialConfig(JSON.parse(JSON.stringify(fullCfg)));
      }
    } catch (e) {
      console.warn("Failed to load AI configuration:", e);
    }
  };

  onMount(() => {
    loadConfig();
  });

  const hasUnsavedChanges = () => {
    const init = initialConfig();
    if (!init) return false;
    return JSON.stringify(config()) !== JSON.stringify(init);
  };

  const handleClose = () => {
    if (hasUnsavedChanges()) {
      if (typeof window !== "undefined" && window.confirm && !window.confirm("You have unsaved AI configuration changes. Discard changes?")) {
        return;
      }
    }
    props.onClose();
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const list = await fetchProviderModels(
        config().active_provider,
        config().base_url,
        config().api_key,
        config().request_format
      );
      if (list && list.length > 0) {
        setFetchedModels(list);
        success("Models Fetched", `Retrieved ${list.length} available models from ${config().active_provider.toUpperCase()} API.`);
      } else {
        error("No Models Found", "API returned empty model list.");
      }
    } catch (err: any) {
      error("Fetch Models Failed", err.message || String(err));
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleProviderChange = (providerId: AIConfig["active_provider"]) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === providerId);
    if (!preset) return;
    setFetchedModels([]);

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

  const handleAvatarFileUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setConfig((prev) => ({ ...prev, user_avatar: dataUrl }));
        success("Avatar Updated", "User avatar loaded from file");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddMcpServer = () => {
    if (!mcpName().trim() || !mcpCommand().trim()) return;
    const newServer: CustomMcpServer = {
      name: mcpName().trim(),
      command: mcpCommand().trim(),
      args: mcpArgs().trim() ? mcpArgs().trim().split(" ") : [],
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

  const handleRemoveMcpServer = (index: number) => {
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
      const base = raw || "https://generativelanguage.googleapis.com/v1beta";
      if (base.includes(":generateContent") || base.includes(":streamGenerateContent")) {
        return base;
      }
      return `${base.replace(/\/+$/, "")}/models/${mdl}:generateContent`;
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
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="bg-card border border-border rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        >
          {/* Modal Header */}
          <div class="p-4 border-b border-border flex items-center justify-between bg-card/80">
            <div class="flex items-center space-x-2.5">
              <div class="w-10 h-10 rounded-xl overflow-hidden shadow-xs ring-1 ring-border bg-black/10 flex items-center justify-center">
                <img src="/berry.png" alt="TheBerry" class="w-full h-full object-cover" />
              </div>
              <div>
                <h2 class="font-semibold text-sm text-foreground">AI Engine & Identity Settings</h2>
                <p class="text-[11px] text-muted-foreground">Configure LLM providers, user identity & MCP tools</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div class="px-5 pt-3 pb-2 border-b border-border flex space-x-1 text-xs bg-muted/20">
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
              onClick={() => setActiveTab("profile")}
              class={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium transition-all ${
                activeTab() === "profile"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <User size={13} />
              <span>User Profile</span>
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
                    <span>API Protocol / Request Format</span>
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
                <Show when={currentPreset().requiresApiKey || config().request_format === "anthropic" || config().request_format === "openai" || config().request_format === "gemini"}>
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
                    <span class="font-semibold text-foreground block">Resolved Request Target:</span>
                    <span class="font-mono text-primary break-all block">{resolvedEndpointPreview()}</span>
                  </div>
                </div>

                {/* Model Selector & Presets */}
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="font-semibold text-foreground">Model Identifier</label>
                    <button
                      type="button"
                      disabled={isFetchingModels()}
                      onClick={handleFetchModels}
                      class="text-[11px] text-primary hover:underline flex items-center space-x-1 disabled:opacity-50 font-medium"
                      title="Query live model list from provider API"
                    >
                      <RefreshCw size={11} class={isFetchingModels() ? "animate-spin" : ""} />
                      <span>{isFetchingModels() ? "Fetching..." : "Fetch Models from API"}</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={config().model}
                    onInput={(e) => setConfig({ ...config(), model: e.currentTarget.value })}
                    placeholder="e.g. gemini-1.5-flash, gemini-2.0-flash, gpt-4o, llama3.2"
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Model Quick Chips (Shows fetched models if available, otherwise preset models) */}
                  <div class="space-y-1.5 pt-0.5">
                    <div class="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{fetchedModels().length > 0 ? `Available Models via API (${fetchedModels().length})` : "Recommended Models"}</span>
                      <Show when={fetchedModels().length > 0}>
                        <button
                          type="button"
                          onClick={() => setFetchedModels([])}
                          class="hover:text-foreground text-[10px] underline"
                        >
                          Reset to Defaults
                        </button>
                      </Show>
                    </div>

                    <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-secondary/20 rounded-lg border border-border/50">
                      <For each={fetchedModels().length > 0 ? fetchedModels() : currentPreset().models}>
                        {(m) => (
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config(), model: m })}
                            class={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
                              config().model === m
                                ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
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
              </div>
            </Show>

            {/* 2. User Profile */}
            <Show when={activeTab() === "profile"}>
              <div class="space-y-5">
                {/* User Name */}
                <div class="space-y-1.5">
                  <label class="font-semibold text-foreground flex items-center justify-between">
                    <span>User Display Name</span>
                    <span class="text-[10px] text-muted-foreground">Displayed in chat headers & context</span>
                  </label>
                  <input
                    type="text"
                    value={config().user_name}
                    onInput={(e) => setConfig({ ...config(), user_name: e.currentTarget.value })}
                    placeholder="Enter your name (e.g. Art, Alex, You)..."
                    class="w-full px-3 py-2 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* User Avatar */}
                <div class="space-y-2">
                  <label class="font-semibold text-foreground">User Avatar</label>
                  <div class="flex items-center space-x-4 p-3 bg-secondary/30 border border-border rounded-xl">
                    <div class="w-14 h-14 rounded-full overflow-hidden ring-2 ring-primary/40 bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Show
                        when={config().user_avatar}
                        fallback={<User size={24} />}
                      >
                        <img
                          src={config().user_avatar}
                          alt={config().user_name}
                          class="w-full h-full object-cover"
                        />
                      </Show>
                    </div>

                    <div class="flex-1 space-y-2">
                      <div class="flex items-center space-x-2">
                        <label class="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary/90 transition-colors flex items-center space-x-1.5 shadow-xs">
                          <ImageIcon size={13} />
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarFileUpload}
                            class="hidden"
                          />
                        </label>

                        <Show when={config().user_avatar}>
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config(), user_avatar: "" })}
                            class="px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors flex items-center space-x-1"
                          >
                            <Trash2 size={12} />
                            <span>Reset</span>
                          </button>
                        </Show>
                      </div>

                      <input
                        type="text"
                        value={config().user_avatar}
                        onInput={(e) => setConfig({ ...config(), user_avatar: e.currentTarget.value })}
                        placeholder="Or enter image URL / Data URI..."
                        class="w-full px-2.5 py-1 bg-background border border-input rounded-md font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Language & Assistant Identity */}
                <div class="space-y-2">
                  <label class="font-semibold text-foreground flex items-center justify-between">
                    <span>Language & Assistant Name</span>
                    <span class="text-[10px] text-muted-foreground">Sets assistant name and language context</span>
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config(), language: "en" });
                        setGlobalLanguage("en");
                      }}
                      class={`p-2.5 rounded-xl border text-left transition-all ${
                        config().language !== "zh"
                          ? "bg-primary/10 border-primary text-foreground shadow-xs"
                          : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <p class="font-semibold text-xs text-foreground">English</p>
                      <p class="text-[10px] text-muted-foreground mt-0.5">Assistant name: TheBerry</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config(), language: "zh" });
                        setGlobalLanguage("zh");
                      }}
                      class={`p-2.5 rounded-xl border text-left transition-all ${
                        config().language === "zh"
                          ? "bg-primary/10 border-primary text-foreground shadow-xs"
                          : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <p class="font-semibold text-xs text-foreground">简体中文</p>
                      <p class="text-[10px] text-muted-foreground mt-0.5">助手名称: 豆花</p>
                    </button>
                  </div>
                </div>

                {/* Assistant Branding Preview */}
                <div class="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-2">
                  <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-full overflow-hidden shadow-xs ring-1 ring-border bg-black/10 flex items-center justify-center">
                      <img src="/berry.png" alt={config().language === "zh" ? "豆花" : "TheBerry"} class="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p class="font-semibold text-xs text-foreground">
                        {config().language === "zh" ? "豆花" : "TheBerry"}
                      </p>
                      <p class="text-[10px] text-muted-foreground">
                        {config().language === "zh"
                          ? "当前语言为中文，助手称呼为“豆花”"
                          : "Active language is English. Assistant name displays as \"TheBerry\"."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Show>

            {/* 3. Parameters */}
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
                            onClick={() => handleRemoveMcpServer(idx())}
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
                onClick={handleClose}
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
