import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
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
} from "lucide-solid";

export function ClipboardView() {
  const [items, setItems] = createSignal<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeFilter, setActiveFilter] = createSignal<"all" | "pinned" | "images" | "links">("all");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [newContent, setNewContent] = createSignal("");
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [previewImage, setPreviewImage] = createSignal<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await getClipboardHistory();
      setItems(list);
    } catch (e) {
      console.warn("Failed to load clipboard history:", e);
    } finally {
      setLoading(false);
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
      } else {
        await copyToSystemClipboard(item.content);
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      await toggleClipboardPin(id);
      await loadHistory();
    } catch (e) {
      console.error("Failed to toggle pin:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClipboardItem(id);
      await loadHistory();
    } catch (e) {
      console.error("Failed to delete item:", e);
    }
  };

  const handleClear = async () => {
    if (confirm("Clear all unpinned clipboard items?")) {
      try {
        await clearClipboardHistory();
        await loadHistory();
      } catch (e) {
        console.error("Failed to clear history:", e);
      }
    }
  };

  const handleAddItem = async () => {
    if (!newContent().trim()) return;
    try {
      await addClipboardItem(newContent().trim());
      setNewContent("");
      setShowAddForm(false);
      await loadHistory();
    } catch (e) {
      console.error("Failed to add clipboard item:", e);
    }
  };

  const filteredItems = () => {
    const q = searchQuery().toLowerCase();
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
            <span class="flex items-center space-x-1 text-[11px] text-green-500 font-medium">
              <Activity size={12} class="animate-pulse" />
              <span>Background Listener Active (Text & Images)</span>
            </span>
            <span class="text-xs text-muted-foreground">• {items().length} items in history</span>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button
            onClick={() => setShowAddForm(!showAddForm())}
            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors"
          >
            <Plus size={14} />
            <span>Add Item</span>
          </button>
          <button
            onClick={loadHistory}
            title="Refresh History"
            class="p-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleClear}
            title="Clear unpinned items"
            class="p-1.5 bg-secondary text-destructive rounded-md hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Add Item Panel */}
      <Show when={showAddForm()}>
        <div class="p-3 bg-card border border-border rounded-lg space-y-2 animate-in fade-in duration-150">
          <textarea
            value={newContent()}
            onInput={(e) => setNewContent(e.currentTarget.value)}
            placeholder="Type or paste text content to save..."
            rows={3}
            class="w-full p-2.5 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div class="flex justify-end space-x-2">
            <button
              onClick={() => setShowAddForm(false)}
              class="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              class="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90"
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
            class="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div class="flex items-center space-x-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "pinned", label: "Pinned" },
              { id: "images", label: "Images" },
              { id: "links", label: "URLs / Links" },
            ] as const
          ).map((f) => (
            <button
              onClick={() => setActiveFilter(f.id)}
              class={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                activeFilter() === f.id
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
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
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-lg">
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
              <div class="p-3 bg-card hover:bg-secondary/40 border border-border rounded-lg transition-colors flex items-start justify-between space-x-3 group">
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
                  </div>

                  {/* Render content: Image thumbnail or text */}
                  {item.content_type === "image" && item.media_data_url ? (
                    <div class="flex items-center space-x-3 pt-1">
                      <img
                        src={item.media_data_url}
                        alt="Clipboard screenshot"
                        onClick={() => setPreviewImage(item.media_data_url || null)}
                        class="max-h-24 max-w-48 rounded border border-border object-contain bg-muted/20 cursor-zoom-in hover:opacity-90 transition-opacity shadow-sm"
                      />
                      <span class="text-xs text-muted-foreground font-mono">
                        {item.preview}
                      </span>
                    </div>
                  ) : (
                    <p class="text-xs font-mono text-foreground whitespace-pre-wrap break-all line-clamp-3 leading-relaxed">
                      {item.content}
                    </p>
                  )}
                </div>

                <div class="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleTogglePin(item.id)}
                    title={item.is_pinned ? "Unpin" : "Pin to Top"}
                    class={`p-1.5 rounded transition-colors ${
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
                    class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                  >
                    {copiedId() === item.id ? (
                      <Check size={13} class="text-green-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Delete Entry"
                    class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
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
          class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 cursor-zoom-out animate-in fade-in"
        >
          <div class="relative max-w-4xl max-h-[85vh] bg-card p-2 rounded-lg border border-border shadow-2xl">
            <img
              src={previewImage()!}
              alt="Full preview"
              class="max-w-full max-h-[80vh] rounded object-contain"
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
