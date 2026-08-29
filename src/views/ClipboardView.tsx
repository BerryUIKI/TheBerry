import { createSignal, onMount, For, Show } from "solid-js";
import { ClipboardItem } from "../types/clipboard";
import {
  getClipboardHistory,
  addClipboardItem,
  toggleClipboardPin,
  deleteClipboardItem,
  clearClipboardHistory,
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
} from "lucide-solid";

export function ClipboardView() {
  const [items, setItems] = createSignal<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [newContent, setNewContent] = createSignal("");
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

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
  });

  const handleCopy = async (item: ClipboardItem) => {
    try {
      await navigator.clipboard.writeText(item.content);
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
    if (confirm("Are you sure you want to clear all unpinned items?")) {
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
    if (!q) return items();
    return items().filter((item) => item.content.toLowerCase().includes(q));
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
          <p class="text-xs text-muted-foreground mt-0.5">
            Store, search, and pin your copied text, links, and code snippets
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <button
            onClick={() => setShowAddForm(!showAddForm())}
            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors"
          >
            <Plus size={14} />
            <span>New Item</span>
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
        <div class="p-3 bg-card border border-border rounded-lg space-y-2">
          <textarea
            value={newContent()}
            onInput={(e) => setNewContent(e.currentTarget.value)}
            placeholder="Type or paste text content to save..."
            rows={3}
            class="w-full p-2 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
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

      {/* Search Bar */}
      <div class="relative">
        <Search size={14} class="absolute left-3 top-2.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Filter clipboard history by keywords..."
          class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* List Content */}
      <div class="flex-1 overflow-y-auto space-y-2 pr-1">
        <Show
          when={filteredItems().length > 0}
          fallback={
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-lg">
              <ClipboardList size={28} class="opacity-40" />
              <p class="text-xs">
                {loading() ? "Loading history..." : "No clipboard entries found."}
              </p>
            </div>
          }
        >
          <For each={filteredItems()}>
            {(item) => (
              <div class="p-3 bg-card hover:bg-secondary/40 border border-border rounded-lg transition-colors flex items-start justify-between space-x-3 group">
                <div class="flex-1 min-w-0 space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono">
                      {item.content_type}
                    </span>
                    <span class="text-[11px] text-muted-foreground">
                      {item.char_count} chars
                    </span>
                    <span class="text-[11px] text-muted-foreground">
                      • {new Date(item.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p class="text-xs font-mono text-foreground whitespace-pre-wrap break-all line-clamp-3">
                    {item.content}
                  </p>
                </div>

                <div class="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleTogglePin(item.id)}
                    title={item.is_pinned ? "Unpin" : "Pin"}
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
                    title="Copy Content"
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
    </div>
  );
}
