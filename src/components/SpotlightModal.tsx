import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { getLauncherItems, launchItem } from "../services/launcher";
import { getClipboardHistory, copyToSystemClipboard } from "../services/clipboard";
import { getSnippets, copyExpandedSnippet } from "../services/snippets";
import { searchFiles, openFilePath } from "../services/fileSearch";
import {
  Search,
  Rocket,
  ClipboardList,
  Code,
  File,
  ArrowRight,
  Sparkles,
  Command,
} from "lucide-solid";

export interface SpotlightItem {
  id: string;
  category: "app" | "clipboard" | "snippet" | "file";
  title: string;
  subtitle: string;
  rawPayload: any;
}

export function SpotlightModal(props: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = createSignal("");
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

  const performSearch = async (text: string) => {
    const q = text.trim().toLowerCase();
    if (!q) {
      // Return top favorite apps and latest clips
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
    launcherCache
      .filter((a) => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((a) => {
        matches.push({
          id: `app_${a.id}`,
          category: "app",
          title: a.name,
          subtitle: `Launch Application (${a.category})`,
          rawPayload: a,
        });
      });

    // 2. Match Snippets
    snippetCache
      .filter((s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((s) => {
        matches.push({
          id: `snip_${s.id}`,
          category: "snippet",
          title: s.title,
          subtitle: `Snippet (${s.language})`,
          rawPayload: s,
        });
      });

    // 3. Match Clipboard
    clipboardCache
      .filter((c) => c.content.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((c) => {
        matches.push({
          id: `clip_${c.id}`,
          category: "clipboard",
          title: c.preview || c.content.slice(0, 60),
          subtitle: "Copy clipboard history",
          rawPayload: c,
        });
      });

    // 4. Match Files (if query >= 2 chars)
    if (q.length >= 2) {
      try {
        const fileHits = await searchFiles({
          pattern: q,
          limit: 4,
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
      props.onClose();
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
      } else if (item.category === "clipboard") {
        await copyToSystemClipboard(item.rawPayload.content);
      } else if (item.category === "snippet") {
        await copyExpandedSnippet(item.rawPayload.content);
      } else if (item.category === "file") {
        await openFilePath(item.rawPayload.path);
      }
    } catch (err) {
      console.error("Spotlight execution error:", err);
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

  return (
    <Show when={props.isOpen}>
      <div
        onClick={props.onClose}
        class="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-start justify-center pt-24 px-4 animate-in fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          class="bg-card border border-border/80 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col divide-y divide-border/60 animate-in zoom-in-95 duration-150"
        >
          {/* Search Header */}
          <div class="flex items-center px-4 py-3 space-x-3 bg-secondary/20">
            <Search size={18} class="text-primary flex-shrink-0" />
            <input
              type="text"
              autofocus
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                performSearch(e.currentTarget.value);
              }}
              placeholder="Spotlight: search apps, clipboard, snippets, or files..."
              class="w-full bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
            />
            <div class="flex items-center space-x-1 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 font-mono">
              <Command size={11} />
              <span>ESC</span>
            </div>
          </div>

          {/* Results List */}
          <div class="max-h-80 overflow-y-auto p-1.5 space-y-1">
            <Show
              when={results().length > 0}
              fallback={
                <div class="py-8 text-center text-xs text-muted-foreground">
                  {loading() ? "Searching federated indexes..." : "No matching items found."}
                </div>
              }
            >
              <For each={results()}>
                {(item, idx) => (
                  <div
                    onClick={() => executeItem(item)}
                    class={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors text-xs ${
                      selectedIndex() === idx()
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-secondary/60 text-foreground"
                    }`}
                  >
                    <div class="flex items-center space-x-3 min-w-0">
                      <div class="p-1 rounded bg-muted/40">{getItemIcon(item.category)}</div>
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

                    <ArrowRight
                      size={14}
                      class={`flex-shrink-0 transition-opacity ${
                        selectedIndex() === idx() ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                )}
              </For>
            </Show>
          </div>

          {/* Footer Hints */}
          <div class="px-4 py-2 bg-secondary/10 flex items-center justify-between text-[11px] text-muted-foreground">
            <div class="flex items-center space-x-3">
              <span>↑↓ Navigate</span>
              <span>↵ Run / Copy</span>
            </div>
            <div class="flex items-center space-x-1 text-primary">
              <Sparkles size={12} />
              <span class="font-medium">Federated Instant Search</span>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
