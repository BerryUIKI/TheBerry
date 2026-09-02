import { createSignal, onMount, onCleanup, For, Show, JSX } from "solid-js";
import { ClipboardItem } from "../types/clipboard";
import {
  getClipboardHistory,
  addClipboardItem,
  toggleClipboardPin,
  deleteClipboardItem,
  clearClipboardHistory,
  copyToSystemClipboard,
  copyImageToSystemClipboard,
  onClipboardUpdated,
} from "../services/clipboard";
import { useToast } from "../context/ToastContext";
import {
  ClipboardList,
  Pin,
  Trash2,
  Copy,
  Plus,
  Search,
  Check,
  RotateCcw,
  Activity,
  Image as ImageIcon,
  ExternalLink,
  Code2,
  CheckSquare,
  Square,
  X,
} from "lucide-solid";

export function ClipboardView() {
  const { success, error, info } = useToast();
  const [items, setItems] = createSignal<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeFilter, setActiveFilter] = createSignal<"all" | "pinned" | "images" | "links">("all");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [newContent, setNewContent] = createSignal("");
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [previewImage, setPreviewImage] = createSignal<string | null>(null);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [batchMode, setBatchMode] = createSignal(false);

  let loadSequence = 0;
  const loadHistory = async () => {
    const seq = ++loadSequence;
    setLoading(true);
    try {
      const list = await getClipboardHistory();
      if (seq === loadSequence) {
        setItems(list);
      }
    } catch (e) {
      if (seq === loadSequence) {
        console.warn("Failed to load clipboard history:", e);
      }
    } finally {
      if (seq === loadSequence) {
        setLoading(false);
      }
    }
  };

  onMount(() => {
    loadHistory();

    // Subscribe to live background clipboard events
    let unlistenFn: (() => void) | null = null;
    onClipboardUpdated((_newItem) => {
      loadHistory();
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    onCleanup(() => {
      if (unlistenFn) unlistenFn();
    });
  });

  const handleCopy = async (item: ClipboardItem) => {
    try {
      if (item.content_type === "image" && item.media_path) {
        await copyImageToSystemClipboard(item.media_path);
        success("Image Copied to Clipboard");
      } else {
        await copyToSystemClipboard(item.content);
        success("Text Copied to Clipboard", item.content.slice(0, 40));
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      error("Copy Failed", String(e));
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      await toggleClipboardPin(id);
      await loadHistory();
    } catch (e) {
      error("Toggle Pin Failed", String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClipboardItem(id);
      success("Item Removed");
      await loadHistory();
    } catch (e) {
      error("Delete Failed", String(e));
    }
  };

  const handleClear = async () => {
    try {
      await clearClipboardHistory();
      success("Clipboard History Cleared", "Unpinned items removed");
      await loadHistory();
    } catch (e) {
      error("Clear Failed", String(e));
    }
  };

  const handleAddItem = async () => {
    if (!newContent().trim()) return;
    try {
      await addClipboardItem(newContent().trim());
      setNewContent("");
      setShowAddForm(false);
      success("Clipboard Item Saved");
      await loadHistory();
    } catch (e) {
      error("Failed to Save Item", String(e));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    const filtered = filteredItems();
    if (selectedIds().size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds());
    if (ids.length === 0) return;

    try {
      for (const id of ids) {
        await deleteClipboardItem(id);
      }
      setSelectedIds(new Set());
      setBatchMode(false);
      success("Batch Delete Complete", `Deleted ${ids.length} item(s)`);
      await loadHistory();
    } catch (e) {
      error("Batch Delete Failed", String(e));
    }
  };

  const isJson = (str: string) => {
    if (!str || str.length < 2) return false;
    const trimmed = str.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const handleFormatJson = async (item: ClipboardItem) => {
    try {
      const parsed = JSON.parse(item.content);
      const formatted = JSON.stringify(parsed, null, 2);
      await copyToSystemClipboard(formatted);
      success("Formatted JSON Copied");
    } catch (e) {
      error("JSON Formatting Failed", String(e));
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      info("Opening URL in Browser", url);
    } catch {
      window.open(url, "_blank");
    }
  };

  const renderHighlighted = (text: string, query: string): JSX.Element => {
    if (!query || !text) return text;
    const cleanQ = query.trim();
    if (!cleanQ) return text;

    const parts = text.split(new RegExp(`(${cleanQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <>
        <For each={parts}>
          {(part) =>
            part.toLowerCase() === cleanQ.toLowerCase() ? (
              <mark class="bg-primary/25 text-primary font-semibold rounded px-0.5">{part}</mark>
            ) : (
              part
            )
          }
        </For>
      </>
    );
  };

  const filteredItems = () => {
    const q = searchQuery().trim().toLowerCase();
    const filter = activeFilter();

    return items().filter((item) => {
      const matchesSearch =
        !q ||
        item.content.toLowerCase().includes(q) ||
        item.preview.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (filter === "pinned") return item.is_pinned;
      if (filter === "images") return item.content_type === "image";
      if (filter === "links")
        return (
          item.content.startsWith("http://") || item.content.startsWith("https://")
        );
      return true;
    });
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header & Controls */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <ClipboardList class="text-primary" size={20} />
            <span>Clipboard History Manager</span>
          </h1>
          <div class="flex items-center space-x-2 mt-0.5">
            <span class="flex items-center space-x-1 text-[11px] text-emerald-500 font-medium">
              <Activity size={12} class="animate-pulse" />
              <span>Background Listener Active (Text & Images)</span>
            </span>
            <span class="text-xs text-muted-foreground">• {items().length} items in history</span>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              setBatchMode(!batchMode());
              if (batchMode()) setSelectedIds(new Set());
            }}
            class={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all border ${
              batchMode()
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border"
            }`}
          >
            {batchMode() ? "Exit Select" : "Select"}
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm())}
            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center space-x-1.5 transition-all shadow-xs active:scale-95"
          >
            <Plus size={14} />
            <span>Add Item</span>
          </button>
          <button
            onClick={loadHistory}
            title="Refresh History"
            class="p-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors border border-border"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleClear}
            title="Clear unpinned items"
            class="p-1.5 bg-secondary text-destructive rounded-lg hover:bg-destructive/10 transition-colors border border-border"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Batch Action Toolbar */}
      <Show when={batchMode()}>
        <div class="p-2.5 bg-card border border-primary/40 rounded-xl flex items-center justify-between text-xs shadow-sm animate-in fade-in">
          <div class="flex items-center space-x-3">
            <button
              onClick={handleSelectAll}
              class="flex items-center space-x-1 text-foreground font-medium hover:text-primary"
            >
              {selectedIds().size === filteredItems().length && filteredItems().length > 0 ? (
                <CheckSquare size={14} class="text-primary" />
              ) : (
                <Square size={14} class="text-muted-foreground" />
              )}
              <span>Select All ({selectedIds().size}/{filteredItems().length})</span>
            </button>
          </div>

          <div class="flex items-center space-x-2">
            <button
              onClick={handleBatchDelete}
              disabled={selectedIds().size === 0}
              class="px-3 py-1 bg-destructive text-destructive-foreground font-medium rounded-lg text-xs hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center space-x-1"
            >
              <Trash2 size={12} />
              <span>Delete Selected ({selectedIds().size})</span>
            </button>
          </div>
        </div>
      </Show>

      {/* Add Item Panel */}
      <Show when={showAddForm()}>
        <div class="p-3.5 bg-card border border-border rounded-xl space-y-2.5 animate-in fade-in duration-150 shadow-sm">
          <textarea
            value={newContent()}
            onInput={(e) => setNewContent(e.currentTarget.value)}
            placeholder="Type or paste text content to save..."
            rows={3}
            class="w-full p-2.5 bg-background border border-input rounded-lg text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div class="flex justify-end space-x-2">
            <button
              onClick={() => setShowAddForm(false)}
              class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              class="px-3.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 shadow-xs active:scale-95"
            >
              Save to Clipboard
            </button>
          </div>
        </div>
      </Show>

      {/* Search & Filter Bar */}
      <div class="flex items-center space-x-3">
        <div class="relative flex-1">
          <Search size={14} class="absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search clipboard history..."
            class="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <div class="flex items-center space-x-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "pinned", label: "Pinned" },
              { id: "images", label: "Images" },
              { id: "links", label: "URLs" },
            ] as const
          ).map((f) => (
            <button
              onClick={() => setActiveFilter(f.id)}
              class={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                activeFilter() === f.id
                  ? "bg-secondary text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Content */}
      <div class="flex-1 overflow-y-auto space-y-2 pr-1">
        <Show
          when={filteredItems().length > 0}
          fallback={
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-xl">
              <ClipboardList size={28} class="opacity-40" />
              <p class="text-xs">
                {loading()
                  ? "Loading history..."
                  : "No clipboard entries. Any text or screenshot you copy in Windows will appear here automatically."}
              </p>
            </div>
          }
        >
          <For each={filteredItems()}>
            {(item) => (
              <div
                class={`p-3.5 bg-card hover:bg-secondary/40 border rounded-xl transition-all flex items-start justify-between space-x-3 group shadow-xs ${
                  selectedIds().has(item.id) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {/* Batch Checkbox */}
                <Show when={batchMode()}>
                  <button
                    onClick={() => toggleSelect(item.id)}
                    class="pt-1 text-muted-foreground hover:text-primary"
                  >
                    {selectedIds().has(item.id) ? (
                      <CheckSquare size={16} class="text-primary" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </Show>

                <div class="flex-1 min-w-0 space-y-1.5">
                  <div class="flex items-center space-x-2">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono flex items-center space-x-1">
                      {item.content_type === "image" ? (
                        <>
                          <ImageIcon size={10} class="text-rose-500" />
                          <span>IMAGE</span>
                        </>
                      ) : item.content.startsWith("http") ? (
                        <span>URL</span>
                      ) : isJson(item.content) ? (
                        <span>JSON</span>
                      ) : (
                        <span>TEXT</span>
                      )}
                    </span>

                    {item.content_type === "image" ? (
                      <span class="text-[11px] text-muted-foreground font-mono">
                        {item.image_width}x{item.image_height} px
                      </span>
                    ) : (
                      <span class="text-[11px] text-muted-foreground font-mono">
                        {item.char_count} chars
                      </span>
                    )}

                    <span class="text-[11px] text-muted-foreground">
                      • {new Date(item.created_at).toLocaleTimeString()}
                    </span>

                    {/* Quick URL or JSON capsules */}
                    <Show when={item.content.startsWith("http://") || item.content.startsWith("https://")}>
                      <button
                        onClick={() => handleOpenUrl(item.content)}
                        class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary font-medium flex items-center space-x-1 transition-colors"
                      >
                        <ExternalLink size={10} />
                        <span>Open Link</span>
                      </button>
                    </Show>

                    <Show when={isJson(item.content)}>
                      <button
                        onClick={() => handleFormatJson(item)}
                        class="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 font-medium flex items-center space-x-1 transition-colors"
                      >
                        <Code2 size={10} />
                        <span>Format JSON</span>
                      </button>
                    </Show>
                  </div>

                  {/* Render content: Image thumbnail or text */}
                  {item.content_type === "image" && item.media_data_url ? (
                    <div class="flex items-center space-x-3 pt-1">
                      <img
                        src={item.media_data_url}
                        alt="Clipboard screenshot"
                        onClick={() => setPreviewImage(item.media_data_url || null)}
                        class="max-h-24 max-w-48 rounded-lg border border-border object-contain bg-muted/20 cursor-zoom-in hover:opacity-90 transition-opacity shadow-xs"
                      />
                      <span class="text-xs text-muted-foreground font-mono">
                        {item.preview}
                      </span>
                    </div>
                  ) : (
                    <p class="text-xs font-mono text-foreground whitespace-pre-wrap break-all line-clamp-3 leading-relaxed">
                      {renderHighlighted(item.content, searchQuery())}
                    </p>
                  )}
                </div>

                <div class="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleTogglePin(item.id)}
                    title={item.is_pinned ? "Unpin" : "Pin to Top"}
                    class={`p-1.5 rounded-lg transition-all active:scale-90 ${
                      item.is_pinned
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Pin size={13} class={item.is_pinned ? "fill-primary" : ""} />
                  </button>
                  <button
                    onClick={() => handleCopy(item)}
                    title="Copy to System Clipboard"
                    class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all active:scale-90"
                  >
                    {copiedId() === item.id ? (
                      <Check size={13} class="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Delete Entry"
                    class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all active:scale-90"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Fullscreen Image Preview Modal */}
      <Show when={previewImage()}>
        <div
          onClick={() => setPreviewImage(null)}
          class="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6 cursor-zoom-out animate-in fade-in"
        >
          <div class="relative max-w-4xl max-h-[85vh] bg-card p-2 rounded-2xl border border-border shadow-2xl animate-in zoom-in-95">
            <img
              src={previewImage()!}
              alt="Full preview"
              class="max-w-full max-h-[80vh] rounded-xl object-contain"
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
