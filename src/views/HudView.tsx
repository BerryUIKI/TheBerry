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
  Terminal,
} from "lucide-solid";
import { useI18n } from "../context/I18nContext";
import { MarkdownContent } from "../components/common/MarkdownContent";
import { sendGooseMessage, onGooseStreamChunk, getAIConfig } from "../services/goose";
import { searchFiles, openFilePath } from "../services/fileSearch";
import { getLauncherItems, launchItem } from "../services/launcher";
import { previewWithQuickLook } from "../services/quicklook";
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

  const isExpanded = () => {
    if (isSearchMode()) {
      return Boolean(getCleanSearchQuery());
    }
    return Boolean(aiResponse() || lastPrompt() || isGenerating() || aiError());
  };

  createEffect(async () => {
    const expanded = isExpanded();
    try {
      const win = getCurrentWebviewWindow();
      await win.setSize(new LogicalSize(640, expanded ? 440 : 84));
    } catch (e) {
      console.warn("Resize error:", e);
    }
  });

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

  // Focus input and fetch initial config
  onMount(async () => {
    try {
      const cfg = await getAIConfig();
      if (cfg) setAiConfig(cfg);
      const launchers = await getLauncherItems();
      setAllLaunchers(launchers);
    } catch (e) {
      console.warn("HUD init load error:", e);
    }

    if (inputRef) {
      inputRef.focus();
    }

    // Listen for AI streaming chunks
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

  // Debounced Search execution when in Search Mode
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
          // 1. Filter Launchers
          const matchedLaunchers = allLaunchers().filter(
            (item) =>
              item.name.toLowerCase().includes(raw.toLowerCase()) ||
              (item.description && item.description.toLowerCase().includes(raw.toLowerCase()))
          );
          setLauncherResults(matchedLaunchers.slice(0, 5));

          // 2. Search local files
          const files = await searchFiles({
            pattern: raw,
            search_root: "",
            max_results: 15,
            file_type_filter: "all",
          });
          setSearchResults(files);
          setSelectedIndex(0);
        } catch (e) {
          console.warn("HUD file search error:", e);
        } finally {
          setIsSearching(false);
        }
      }, 150);
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

  const handleSendAI = async () => {
    const text = query().trim();
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
      await handleClose();
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
    if (item.is_dir) return <Folder size={14} class="text-amber-400" />;
    const ext = item.extension.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "ico"].includes(ext)) {
      return <ImageIcon size={14} class="text-sky-400" />;
    }
    if (["ts", "tsx", "js", "jsx", "rs", "py", "json", "toml", "html", "css"].includes(ext)) {
      return <FileCode size={14} class="text-emerald-400" />;
    }
    if (["md", "txt", "pdf", "docx", "doc"].includes(ext)) {
      return <FileText size={14} class="text-rose-400" />;
    }
    return <File size={14} class="text-muted-foreground" />;
  };

  return (
    <div class="w-full h-full bg-transparent flex flex-col items-center justify-start p-2 font-sans select-none animate-in fade-in zoom-in-95">
      {/* 1. Main Search & Prompt Bar (1Password / Raycast Style) */}
      <div class="w-full bg-[#18181b]/95 dark:bg-[#121215]/95 backdrop-blur-2xl rounded-2xl border border-rose-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 flex flex-col overflow-hidden transition-all">
        <div class="flex items-center px-4 py-3.5 space-x-3">
          {/* Leading Mode Icon */}
          <div class="flex-shrink-0 flex items-center justify-center text-rose-400">
            {isSearchMode() ? (
              <Search size={18} class="text-sky-400" />
            ) : (
              <Sparkles size={18} class="text-rose-400" />
            )}
          </div>

          {/* Omni-Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              language() === "zh"
                ? `向 ${assistantName()} 提问... (输入 /fin 检索本地文件)`
                : `Ask ${assistantName()} anything... (Type /fin to search files)`
            }
            class="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-500 font-medium"
            autofocus
          />

          {/* Right Mode Tag & Status */}
          <div class="flex items-center space-x-2 flex-shrink-0">
            <Show when={isSearchMode()}>
              <span class="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[10px] font-mono font-semibold text-sky-400">
                LOCAL SEARCH
              </span>
            </Show>

            <Show when={isGenerating() || isSearching()}>
              <RefreshCw size={14} class="animate-spin text-rose-400" />
            </Show>

            <Show when={!isGenerating() && !isSearching()}>
              <div class="w-6 h-6 rounded-full overflow-hidden shadow-xs ring-1 ring-border/50 bg-black/20 flex items-center justify-center">
                <img src="/berry.png" alt="Berry" class="w-full h-full object-cover" />
              </div>
            </Show>
          </div>
        </div>

        {/* 2. Expanded AI Conversation Card */}
        <Show when={!isSearchMode() && (aiResponse() || lastPrompt() || isGenerating() || aiError())}>
          <div class="border-t border-zinc-800/80 bg-zinc-950/60 p-4 max-h-[340px] overflow-y-auto space-y-3">
            {/* Prompt Echo */}
            <div class="flex items-start justify-between text-xs text-zinc-400 border-b border-zinc-800/50 pb-2">
              <span class="font-medium text-zinc-300 line-clamp-1">{lastPrompt()}</span>
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

            {/* Markdown AI Output */}
            <div class="text-xs text-zinc-200 select-text leading-relaxed">
              <Show when={aiResponse()}>
                <MarkdownContent content={aiResponse()} />
              </Show>

              <Show when={isGenerating()}>
                <span class="inline-block w-1.5 h-3.5 ml-1 bg-rose-500 animate-pulse align-middle" />
              </Show>

              <Show when={aiError()}>
                <div class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {aiError()}
                </div>
              </Show>
            </div>
          </div>
        </Show>

        {/* 3. Expanded Local File & Launcher Search List */}
        <Show when={isSearchMode() && getCleanSearchQuery()}>
          <div class="border-t border-zinc-800/80 bg-zinc-950/70 p-2 max-h-[320px] overflow-y-auto space-y-1">
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
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
                    }`}
                  >
                    <div class="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div class="flex-shrink-0">
                        {item.type === "launcher" ? (
                          <Rocket size={14} class="text-rose-400" />
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
                        <span class="px-1.5 py-0.5 rounded bg-zinc-800/80 font-mono border border-zinc-700/60 flex items-center space-x-1">
                          <Eye size={10} />
                          <span>Space</span>
                        </span>
                      </Show>
                      <span class="px-1.5 py-0.5 rounded bg-zinc-800/80 font-mono border border-zinc-700/60 flex items-center space-x-1">
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

        {/* 4. Bottom Keyboard Hints Bar (1Password Style) */}
        <div class="px-4 py-2 border-t border-zinc-800/60 bg-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-400">
          <div class="flex items-center space-x-3">
            <div class="flex items-center space-x-1">
              <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
                Alt
              </kbd>
              <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
                Space
              </kbd>
              <span class="text-zinc-400 ml-1">Quick Access</span>
            </div>

            <div class="flex items-center space-x-1">
              <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 font-semibold shadow-xs">
                /fin
              </kbd>
              <span class="text-zinc-400 ml-1">Search Files</span>
            </div>
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
