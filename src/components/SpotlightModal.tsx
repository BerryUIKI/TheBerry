import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { getLauncherItems, launchItem } from "../services/launcher";
import { getClipboardHistory, copyToSystemClipboard } from "../services/clipboard";
import { getSnippets, copyExpandedSnippet } from "../services/snippets";
import { searchFiles, openFilePath, revealInExplorer } from "../services/fileSearch";
import { previewWithQuickLook } from "../services/quicklook";
import { useToast } from "../context/ToastContext";
import {
  Search,
  Rocket,
  ClipboardList,
  Code,
  File,
  ArrowRight,
  Sparkles,
  Command,
  Copy,
  FolderOpen,
  Eye,
} from "lucide-solid";

export interface SpotlightItem {
  id: string;
  category: "app" | "clipboard" | "snippet" | "file";
  title: string;
  subtitle: string;
  rawPayload: any;
}

type FilterTag = "all" | "app" | "clipboard" | "snippet" | "file";

export function SpotlightModal(props: { isOpen: boolean; onClose: () => void }) {
  const { success, info } = useToast();
  const [query, setQuery] = createSignal("");
  const [activeFilter, setActiveFilter] = createSignal<FilterTag>("all");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [results, setResults] = createSignal<SpotlightItem[]>([]);
  const [loading, setLoading] = createSignal(false);

  // Cached data sets
  let launcherCache: any[] = [];
  let clipboardCache: any[] = [];
  let snippetCache: any[] = [];

  const refreshCaches = async () => {
    try {
      const [apps, clips, snips] = await Promise.allSettled([
        getLauncherItems(),
        getClipboardHistory(),
        getSnippets(),
      ]);
      if (apps.status === "fulfilled") launcherCache = apps.value;
      if (clips.status === "fulfilled") clipboardCache = clips.value;
      if (snips.status === "fulfilled") snippetCache = snips.value;
    } catch (e) {
      console.warn("Spotlight cache preload warning:", e);
    }
  };

  onMount(() => {
    refreshCaches();
  });

  const performSearch = async (text: string, filterOverride?: FilterTag) => {
    let rawText = text.trim();
    let effectiveFilter = filterOverride ?? activeFilter();

    // Check for prefix shortcuts like @app, @clip, @snip, @file
    if (rawText.startsWith("@app")) {
      effectiveFilter = "app";
      rawText = rawText.replace(/^@app\s*/, "");
    } else if (rawText.startsWith("@clip")) {
      effectiveFilter = "clipboard";
      rawText = rawText.replace(/^@clip\s*/, "");
    } else if (rawText.startsWith("@snip")) {
      effectiveFilter = "snippet";
      rawText = rawText.replace(/^@snip\s*/, "");
    } else if (rawText.startsWith("@file")) {
      effectiveFilter = "file";
      rawText = rawText.replace(/^@file\s*/, "");
    }

    const q = rawText.toLowerCase();

    if (!q && effectiveFilter === "all") {
      // Default top suggestions
      const initial: SpotlightItem[] = [
        ...launcherCache.slice(0, 4).map((a) => ({
          id: `app_${a.id}`,
          category: "app" as const,
          title: a.name,
          subtitle: a.description || a.exec_path,
          rawPayload: a,
        })),
        ...clipboardCache.slice(0, 3).map((c) => ({
          id: `clip_${c.id}`,
          category: "clipboard" as const,
          title: c.preview || c.content.slice(0, 60),
          subtitle: "Recent clipboard item",
          rawPayload: c,
        })),
      ];
      setResults(initial);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    const matches: SpotlightItem[] = [];

    // 1. Match Apps
    if (effectiveFilter === "all" || effectiveFilter === "app") {
      launcherCache
        .filter((a) => !q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((a) => {
          matches.push({
            id: `app_${a.id}`,
            category: "app",
            title: a.name,
            subtitle: `Launch Application (${a.category})`,
            rawPayload: a,
          });
        });
    }

    // 2. Match Snippets
    if (effectiveFilter === "all" || effectiveFilter === "snippet") {
      snippetCache
        .filter((s) => !q || s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((s) => {
          matches.push({
            id: `snip_${s.id}`,
            category: "snippet",
            title: s.title,
            subtitle: `Snippet (${s.language})`,
            rawPayload: s,
          });
        });
    }

    // 3. Match Clipboard
    if (effectiveFilter === "all" || effectiveFilter === "clipboard") {
      clipboardCache
        .filter((c) => !q || c.content.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((c) => {
          matches.push({
            id: `clip_${c.id}`,
            category: "clipboard",
            title: c.preview || c.content.slice(0, 60),
            subtitle: "Clipboard item",
            rawPayload: c,
          });
        });
    }

    // 4. Match Files (if query >= 2 chars or explicit @file filter)
    if ((effectiveFilter === "file" && q.length >= 1) || (effectiveFilter === "all" && q.length >= 2)) {
      try {
        const fileHits = await searchFiles({
          query: q,
          limit: 5,
          file_type: "all",
          case_sensitive: false,
        });
        fileHits.forEach((f) => {
          matches.push({
            id: `file_${f.path}`,
            category: "file",
            title: f.name,
            subtitle: f.path,
            rawPayload: f,
          });
        });
      } catch (err) {
        console.warn("File search in spotlight:", err);
      }
    }

    setResults(matches);
    setSelectedIndex(0);
    setLoading(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;

    if (e.key === "Escape") {
      if (query().length > 0) {
        setQuery("");
        performSearch("");
      } else {
        props.onClose();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results().length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results().length) % Math.max(1, results().length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = results()[selectedIndex()];
      if (current) executeItem(current);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const current = results()[selectedIndex()];
      if (current) {
        e.preventDefault();
        copyItemContent(current);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
      const current = results()[selectedIndex()];
      if (current) {
        e.preventDefault();
        revealCurrentItem(current);
      }
    } else if (e.code === "Space" && (e.shiftKey || e.ctrlKey)) {
      const current = results()[selectedIndex()];
      if (current && current.category === "file") {
        e.preventDefault();
        previewWithQuickLook(current.rawPayload.path);
      } else if (current && current.category === "app" && current.rawPayload.exec_path) {
        e.preventDefault();
        previewWithQuickLook(current.rawPayload.exec_path);
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const executeItem = async (item: SpotlightItem) => {
    props.onClose();
    try {
      if (item.category === "app") {
        await launchItem(item.rawPayload.id);
        success("Application Launched", item.title);
      } else if (item.category === "clipboard") {
        await copyToSystemClipboard(item.rawPayload.content);
        success("Copied to Clipboard", item.title);
      } else if (item.category === "snippet") {
        await copyExpandedSnippet(item.rawPayload.content);
        success("Expanded Snippet Copied", item.title);
      } else if (item.category === "file") {
        await openFilePath(item.rawPayload.path);
        info("Opening File", item.title);
      }
    } catch (err) {
      console.error("Spotlight execution error:", err);
    }
  };

  const copyItemContent = async (item: SpotlightItem) => {
    try {
      let text = item.title;
      if (item.category === "file") text = item.rawPayload.path;
      else if (item.category === "app") text = item.rawPayload.exec_path;
      else if (item.category === "clipboard" || item.category === "snippet") {
        text = item.rawPayload.content;
      }
      await copyToSystemClipboard(text);
      success("Copied to Clipboard", text.slice(0, 40));
    } catch (err) {
      console.warn("Copy error:", err);
    }
  };

  const revealCurrentItem = async (item: SpotlightItem) => {
    try {
      if (item.category === "file") {
        await revealInExplorer(item.rawPayload.path);
      } else if (item.category === "app" && item.rawPayload.exec_path) {
        await revealInExplorer(item.rawPayload.exec_path);
      }
    } catch (err) {
      console.warn("Reveal error:", err);
    }
  };

  const getItemIcon = (cat: SpotlightItem["category"]) => {
    switch (cat) {
      case "app":
        return <Rocket size={15} class="text-blue-500" />;
      case "clipboard":
        return <ClipboardList size={15} class="text-amber-500" />;
      case "snippet":
        return <Code size={15} class="text-emerald-500" />;
      case "file":
        return <File size={15} class="text-rose-500" />;
    }
  };

  const filterTabs: { id: FilterTag; label: string; prefix: string }[] = [
    { id: "all", label: "All", prefix: "" },
    { id: "app", label: "Apps", prefix: "@app " },
    { id: "clipboard", label: "Clipboard", prefix: "@clip " },
    { id: "snippet", label: "Snippets", prefix: "@snip " },
    { id: "file", label: "Files", prefix: "@file " },
  ];

  return (
    <Show when={props.isOpen}>
      <div
        onClick={props.onClose}
        class="fixed inset-0 bg-background/70 backdrop-blur-md z-50 flex items-start justify-center pt-20 px-4 animate-in fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="bg-card/95 border border-border rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col backdrop-blur-2xl animate-in zoom-in-95 duration-150"
        >
          {/* Search Header */}
          <div class="flex items-center px-4 py-3.5 space-x-3 bg-secondary/30 border-b border-border/70">
            <Search size={18} class="text-primary flex-shrink-0" />
            <input
              type="text"
              autofocus
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                performSearch(e.currentTarget.value);
              }}
              placeholder="Search or type @app, @clip, @snip, @file..."
              class="w-full bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
            />
            <div class="flex items-center space-x-1 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted font-mono border border-border/60">
              <Command size={11} />
              <span>ESC</span>
            </div>
          </div>

          {/* Filter Pills */}
          <div class="flex items-center space-x-1.5 px-3.5 py-2 border-b border-border/50 bg-muted/20 text-xs">
            <For each={filterTabs}>
              {(tab) => (
                <button
                  onClick={() => {
                    setActiveFilter(tab.id);
                    performSearch(query(), tab.id);
                  }}
                  class={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    activeFilter() === tab.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>

          {/* Results List */}
          <div class="max-h-80 overflow-y-auto p-2 space-y-1">
            <Show
              when={results().length > 0}
              fallback={
                <div class="py-10 text-center space-y-2">
                  <p class="text-xs text-muted-foreground">
                    {loading() ? "Searching federated indexes..." : "No matching items found."}
                  </p>
                  <p class="text-[11px] text-muted-foreground/70">
                    Try prefixing with <code class="px-1 py-0.5 rounded bg-muted">@app</code>,{" "}
                    <code class="px-1 py-0.5 rounded bg-muted">@file</code> or{" "}
                    <code class="px-1 py-0.5 rounded bg-muted">@snip</code>
                  </p>
                </div>
              }
            >
              <For each={results()}>
                {(item, idx) => (
                  <div
                    onClick={() => executeItem(item)}
                    class={`px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all text-xs ${
                      selectedIndex() === idx()
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "hover:bg-secondary/70 text-foreground"
                    }`}
                  >
                    <div class="flex items-center space-x-3 min-w-0">
                      <div
                        class={`p-1.5 rounded-lg ${
                          selectedIndex() === idx() ? "bg-primary-foreground/20" : "bg-muted"
                        }`}
                      >
                        {getItemIcon(item.category)}
                      </div>
                      <div class="min-w-0">
                        <p class="font-medium truncate">{item.title}</p>
                        <p
                          class={`text-[10px] truncate ${
                            selectedIndex() === idx()
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center space-x-2 flex-shrink-0">
                      <Show when={item.category === "file"}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            previewWithQuickLook(item.rawPayload.path);
                          }}
                          title="Quick Look Preview"
                          class="p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Eye size={13} />
                        </button>
                      </Show>
                      <Show when={selectedIndex() === idx()}>
                        <span class="text-[10px] opacity-75 font-mono">↵ Run</span>
                      </Show>
                      <ArrowRight
                        size={14}
                        class={`transition-opacity ${
                          selectedIndex() === idx() ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer Hints */}
          <div class="px-4 py-2.5 bg-secondary/30 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
            <div class="flex items-center space-x-3 font-medium">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>Shift+Space Preview</span>
              <span>Ctrl+C Copy</span>
              <span>Ctrl+E Reveal</span>
            </div>
            <div class="flex items-center space-x-1 text-primary">
              <Sparkles size={12} />
              <span class="font-semibold tracking-tight">Federated Search</span>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
