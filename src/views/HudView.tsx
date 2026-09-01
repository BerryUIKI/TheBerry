import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import {
  Search,
  Sparkles,
  Send,
  X,
  File,
  Folder,
  FileCode,
  FileText,
  Image as ImageIcon,
  Rocket,
  CornerDownLeft,
  Copy,
  Check,
  RefreshCw,
  Eye,
  MessageSquare,
} from "lucide-solid";
import { useI18n } from "../context/I18nContext";
import { MarkdownContent } from "../components/common/MarkdownContent";
import { sendGooseMessage, onGooseStreamChunk, getAIConfig } from "../services/goose";
import { searchFiles, openFilePath } from "../services/fileSearch";
import { getLauncherItems, launchItem } from "../services/launcher";
import { previewWithQuickLook } from "../services/quicklook";
import { resizeHudWindow } from "../services/shortcuts";
import { SearchResultItem } from "../types/fileSearch";
import { LauncherItem } from "../types/launcher";
import { AIConfig } from "../types/goose";

export function HudView() {
  const { t, language, assistantName } = useI18n();
  const [query, setQuery] = createSignal("");
  const [aiConfig, setAiConfig] = createSignal<AIConfig | null>(null);

  // AI Mode State
  const [lastPrompt, setLastPrompt] = createSignal("");
  const [aiResponse, setAiResponse] = createSignal("");
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [aiError, setAiError] = createSignal<string | null>(null);
  const [copiedResponse, setCopiedResponse] = createSignal(false);

  // Search Mode State
  const [searchResults, setSearchResults] = createSignal<SearchResultItem[]>([]);
  const [launcherResults, setLauncherResults] = createSignal<LauncherItem[]>([]);
  const [allLaunchers, setAllLaunchers] = createSignal<LauncherItem[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isSearching, setIsSearching] = createSignal(false);

  let inputRef: HTMLInputElement | undefined;

  // Determine current mode based on query prefix
  const isSearchMode = () => {
    const q = query().trimStart();
    return q.startsWith("/fin") || q.startsWith("/f ");
  };

  const getCleanSearchQuery = () => {
    const q = query().trimStart();
    if (q.startsWith("/fin")) {
      return q.slice(4).trim();
    }
    if (q.startsWith("/f ")) {
      return q.slice(3).trim();
    }
    return q;
  };

  const combinedSearchItems = () => {
    const launchers = launcherResults().map((l) => ({ type: "launcher" as const, data: l }));
    const files = searchResults().map((f) => ({ type: "file" as const, data: f }));
    return [...launchers, ...files];
  };

  // Determine if HUD is in expanded state
  const isExpanded = () => {
    if (isSearchMode()) {
      return Boolean(getCleanSearchQuery());
    }
    return Boolean(aiResponse() || lastPrompt() || isGenerating() || aiError());
  };

  // Dynamic Height Resizing (96px collapsed, 480px expanded for both AI & Search modes)
  createEffect(async () => {
    const expanded = isExpanded();
    const targetHeight = expanded ? 480 : 96;
    try {
      await resizeHudWindow(targetHeight);
      const win = getCurrentWebviewWindow();
      await win.setSize(new LogicalSize(640, targetHeight));
    } catch (e) {
      console.warn("HUD window resize error:", e);
    }
  });

  onMount(async () => {
    try {
      const cfg = await getAIConfig();
      if (cfg) setAiConfig(cfg);
      const launchers = await getLauncherItems();
      setAllLaunchers(launchers);
    } catch (e) {
      console.warn("HUD init error:", e);
    }

    if (inputRef) {
      inputRef.focus();
    }

    // Stream listener
    let unlistenStream: (() => void) | null = null;
    onGooseStreamChunk((chunk) => {
      if (chunk.session_id === "hud-session") {
        if (chunk.delta) {
          setAiResponse((prev) => prev + chunk.delta);
        }
        if (chunk.error) {
          setAiError(chunk.error);
          setIsGenerating(false);
        }
        if (chunk.is_finished) {
          setIsGenerating(false);
        }
      }
    }).then((unlisten) => {
      unlistenStream = unlisten;
    });

    onCleanup(() => {
      if (unlistenStream) unlistenStream();
    });
  });

  // Debounced search
  let searchTimer: any = null;
  createEffect(() => {
    if (isSearchMode()) {
      const raw = getCleanSearchQuery();
      clearTimeout(searchTimer);
      if (!raw) {
        setSearchResults([]);
        setLauncherResults([]);
        setSelectedIndex(0);
        return;
      }

      setIsSearching(true);
      searchTimer = setTimeout(async () => {
        try {
          const matchedLaunchers = allLaunchers().filter(
            (item) =>
              item.name.toLowerCase().includes(raw.toLowerCase()) ||
              (item.description && item.description.toLowerCase().includes(raw.toLowerCase()))
          );
          setLauncherResults(matchedLaunchers.slice(0, 4));

          const files = await searchFiles({
            pattern: raw,
            search_root: "",
            max_results: 12,
            file_type_filter: "all",
          });
          setSearchResults(files);
          setSelectedIndex(0);
        } catch (e) {
          console.warn("HUD file search error:", e);
        } finally {
          setIsSearching(false);
        }
      }, 120);
    }
  });

  const handleClose = async () => {
    try {
      const win = getCurrentWebviewWindow();
      await win.hide();
    } catch (e) {
      console.warn("Failed to hide HUD window:", e);
    }
  };

  const handleResetAndClear = () => {
    setQuery("");
    setLastPrompt("");
    setAiResponse("");
    setAiError(null);
    setSearchResults([]);
    setLauncherResults([]);
    setSelectedIndex(0);
    inputRef?.focus();
  };

  const handleSendAI = async (customPrompt?: string) => {
    const text = customPrompt || query().trim();
    if (!text || isGenerating()) return;

    setLastPrompt(text);
    setAiResponse("");
    setAiError(null);
    setIsGenerating(true);

    try {
      await sendGooseMessage({
        session_id: "hud-session",
        prompt: text,
      });
    } catch (err: any) {
      setAiError(err.message || String(err));
      setIsGenerating(false);
    }
  };

  const handleOpenSearchItem = async (index: number) => {
    const items = combinedSearchItems();
    const item = items[index];
    if (!item) return;

    if (item.type === "launcher") {
      await launchItem(item.data.id);
    } else {
      await openFilePath(item.data.path);
    }
    await handleClose();
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (isExpanded()) {
        handleResetAndClear();
      } else {
        await handleClose();
      }
      return;
    }

    if (isSearchMode()) {
      const items = combinedSearchItems();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
        return;
      }
      if (e.code === "Space" && items.length > 0) {
        const item = items[selectedIndex()];
        if (item && item.type === "file" && !item.data.is_dir) {
          e.preventDefault();
          try {
            await previewWithQuickLook(item.data.path);
          } catch (err) {
            console.warn("QuickLook preview error:", err);
          }
          return;
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (items.length > 0) {
          await handleOpenSearchItem(selectedIndex());
        }
        return;
      }
    } else {
      // AI Mode
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await handleSendAI();
      }
    }
  };

  const handleCopyAIResponse = async () => {
    if (!aiResponse()) return;
    try {
      await navigator.clipboard.writeText(aiResponse());
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    } catch (e) {
      console.warn("Copy failed:", e);
    }
  };

  const getFileIcon = (item: SearchResultItem) => {
    if (item.is_dir) return <Folder size={15} class="text-amber-400" />;
    const ext = item.extension.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "ico"].includes(ext)) {
      return <ImageIcon size={15} class="text-sky-400" />;
    }
    if (["ts", "tsx", "js", "jsx", "rs", "py", "json", "toml", "html", "css"].includes(ext)) {
      return <FileCode size={15} class="text-emerald-400" />;
    }
    if (["md", "txt", "pdf", "docx", "doc"].includes(ext)) {
      return <FileText size={15} class="text-rose-400" />;
    }
    return <File size={15} class="text-zinc-400" />;
  };

  return (
    <div class="w-screen h-screen bg-[#131316] text-zinc-100 flex flex-col font-sans select-none overflow-hidden border border-zinc-800/80 rounded-2xl shadow-2xl">
      {/* 1. Header Omni-Input Bar (h-14 / 56px) */}
      <div class="h-14 flex items-center px-4 border-b border-zinc-800/80 space-x-3 bg-zinc-900/50 flex-shrink-0">
        <div class="flex-shrink-0 flex items-center justify-center">
          <Show
            when={isSearchMode()}
            fallback={<Sparkles size={18} class="text-rose-400 animate-pulse" />}
          >
            <Search size={18} class="text-sky-400" />
          </Show>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            language() === "zh"
              ? `向 ${assistantName()} 提问... (输入 /fin 搜索本地文件)`
              : `Ask ${assistantName()} anything... (Type /fin to search files)`
          }
          class="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-500 font-medium"
          autofocus
        />

        {/* Right Controls */}
        <div class="flex items-center space-x-2 flex-shrink-0">
          <Show when={query() || isExpanded()}>
            <button
              onClick={handleResetAndClear}
              title="Clear / Reset"
              class="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          </Show>

          <Show when={isSearchMode()}>
            <span class="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[10px] font-mono font-semibold text-sky-400">
              LOCAL SEARCH
            </span>
          </Show>

          <Show when={isGenerating() || isSearching()}>
            <RefreshCw size={14} class="animate-spin text-rose-400" />
          </Show>

          <Show when={!isGenerating() && !isSearching()}>
            <div class="w-6 h-6 rounded-full overflow-hidden shadow-xs ring-1 ring-white/10 bg-black/40 flex items-center justify-center">
              <img src="/berry.png" alt="Berry" class="w-full h-full object-cover" />
            </div>
          </Show>
        </div>
      </div>

      {/* 2. Middle Scrollable Content Area (Only rendered when expanded) */}
      <Show when={isExpanded()}>
        <div class="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* AI Response Mode */}
          <Show when={!isSearchMode() && (aiResponse() || lastPrompt() || isGenerating() || aiError())}>
            <div class="space-y-3">
              {/* Prompt Header */}
              <Show when={lastPrompt()}>
                <div class="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/60 text-xs text-zinc-300">
                  <div class="flex items-center space-x-2 min-w-0">
                    <span class="text-rose-400 font-semibold flex-shrink-0">You:</span>
                    <span class="truncate">{lastPrompt()}</span>
                  </div>
                  <Show when={aiResponse() && !isGenerating()}>
                    <button
                      type="button"
                      onClick={handleCopyAIResponse}
                      class="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center space-x-1 transition-colors ml-2 flex-shrink-0"
                    >
                      {copiedResponse() ? (
                        <>
                          <Check size={11} class="text-emerald-400" />
                          <span class="text-emerald-400 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </Show>
                </div>
              </Show>

              {/* AI Streaming Body */}
              <div class="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60 text-xs text-zinc-200 select-text leading-relaxed">
                <Show when={aiResponse()}>
                  <MarkdownContent content={aiResponse()} />
                </Show>

                <Show when={isGenerating()}>
                  <div class="flex items-center space-x-2 text-rose-400 font-medium text-xs mt-1">
                    <span class="inline-block w-1.5 h-3.5 bg-rose-500 animate-pulse" />
                    <span>{language() === "zh" ? `${assistantName()} 正在思考并组织回答...` : `${assistantName()} is generating...`}</span>
                  </div>
                </Show>

                <Show when={aiError()}>
                  <div class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    {aiError()}
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* Search Results Mode */}
          <Show when={isSearchMode() && getCleanSearchQuery()}>
            <div class="space-y-1">
              <Show
                when={combinedSearchItems().length > 0}
                fallback={
                  <div class="py-6 text-center text-xs text-zinc-500">
                    {isSearching() ? "Searching local drives..." : "No matching files or apps found"}
                  </div>
                }
              >
                <For each={combinedSearchItems()}>
                  {(item, index) => (
                    <div
                      onClick={() => handleOpenSearchItem(index())}
                      onMouseEnter={() => setSelectedIndex(index())}
                      class={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                        selectedIndex() === index()
                          ? "bg-rose-500/15 border border-rose-500/30 text-zinc-100 font-medium shadow-xs"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent"
                      }`}
                    >
                      <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div class="flex-shrink-0">
                          {item.type === "launcher" ? (
                            <Rocket size={15} class="text-rose-400" />
                          ) : (
                            getFileIcon(item.data)
                          )}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="truncate text-xs text-zinc-200 font-medium">
                            {item.type === "launcher" ? item.data.name : item.data.name}
                          </span>
                          <span class="truncate text-[10px] text-zinc-500 font-mono">
                            {item.type === "launcher"
                              ? item.data.exec_path
                              : item.data.path}
                          </span>
                        </div>
                      </div>

                      <div class="flex items-center space-x-1.5 flex-shrink-0 text-[10px] text-zinc-500">
                        <Show when={item.type === "file" && !item.data.is_dir}>
                          <span class="px-1.5 py-0.5 rounded bg-zinc-800 font-mono border border-zinc-700/60 flex items-center space-x-1">
                            <Eye size={10} />
                            <span>Space</span>
                          </span>
                        </Show>
                        <span class="px-1.5 py-0.5 rounded bg-zinc-800 font-mono border border-zinc-700/60 flex items-center space-x-1">
                          <CornerDownLeft size={10} />
                          <span>Open</span>
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* 3. Footer Shortcuts Bar (h-9 / 36px) */}
      <div class="h-9 px-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-400 flex-shrink-0">
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-1">
            <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
              Enter
            </kbd>
            <span class="text-zinc-400 ml-1">{isSearchMode() ? "Open" : "Send"}</span>
          </div>

          <Show when={isSearchMode()}>
            <div class="flex items-center space-x-1">
              <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
                Space
              </kbd>
              <span class="text-zinc-400 ml-1">QuickLook</span>
            </div>
          </Show>

          <Show when={!isSearchMode()}>
            <div class="flex items-center space-x-1">
              <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
                /fin
              </kbd>
              <span class="text-zinc-400 ml-1">Search Mode</span>
            </div>
          </Show>
        </div>

        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-1">
            <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
              Alt Space
            </kbd>
            <span class="text-zinc-400 ml-1">Toggle</span>
          </div>

          <div class="flex items-center space-x-1">
            <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
              Esc
            </kbd>
            <span class="text-zinc-400 ml-1">Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
