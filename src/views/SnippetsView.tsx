import { createSignal, onMount, For, Show } from "solid-js";
import { SnippetItem, SnippetPayload } from "../types/snippets";
import { getSnippets, saveSnippet, deleteSnippet } from "../services/snippets";
import {
  Code2,
  Plus,
  Copy,
  Check,
  Trash2,
  Star,
  Search,
  RotateCcw,
} from "lucide-solid";

const LANGUAGES = [
  "rust",
  "typescript",
  "javascript",
  "python",
  "shell",
  "sql",
  "json",
  "html",
  "css",
  "markdown",
];

export function SnippetsView() {
  const [snippets, setSnippets] = createSignal<SnippetItem[]>([]);
  const [selectedSnippet, setSelectedSnippet] = createSignal<SnippetItem | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [formData, setFormData] = createSignal<SnippetPayload>({
    title: "",
    description: "",
    content: "",
    language: "typescript",
    category: "General",
    tags: [],
  });

  const loadSnippets = async () => {
    try {
      const list = await getSnippets();
      setSnippets(list);
      if (list.length > 0 && !selectedSnippet()) {
        setSelectedSnippet(list[0]);
      }
    } catch (e) {
      console.warn("Failed to load snippets:", e);
    }
  };

  onMount(() => {
    loadSnippets();
  });

  const handleCopy = async (snippet: SnippetItem) => {
    try {
      await navigator.clipboard.writeText(snippet.content);
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleSave = async () => {
    const data = formData();
    if (!data.title.trim() || !data.content.trim()) return;

    try {
      const saved = await saveSnippet(data);
      setIsEditing(false);
      await loadSnippets();
      setSelectedSnippet(saved);
    } catch (e) {
      console.error("Save snippet failed:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this snippet?")) {
      try {
        await deleteSnippet(id);
        if (selectedSnippet()?.id === id) {
          setSelectedSnippet(null);
        }
        await loadSnippets();
      } catch (e) {
        console.error("Delete snippet failed:", e);
      }
    }
  };

  const handleToggleFavorite = async (snippet: SnippetItem) => {
    try {
      await saveSnippet({
        id: snippet.id,
        title: snippet.title,
        description: snippet.description,
        content: snippet.content,
        language: snippet.language,
        category: snippet.category,
        tags: snippet.tags,
        is_favorite: !snippet.is_favorite,
      });
      await loadSnippets();
    } catch (e) {
      console.error("Toggle favorite failed:", e);
    }
  };

  const openNewSnippetForm = () => {
    setFormData({
      title: "",
      description: "",
      content: "",
      language: "typescript",
      category: "General",
      tags: [],
    });
    setIsEditing(true);
  };

  const filteredSnippets = () => {
    const q = searchQuery().toLowerCase();
    if (!q) return snippets();
    return snippets().filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q)
    );
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Code2 class="text-primary" size={20} />
            <span>Developer Code & Text Snippets</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Organize reusable boilerplate, regex, commands, and code blocks
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <button
            onClick={openNewSnippetForm}
            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors"
          >
            <Plus size={14} />
            <span>New Snippet</span>
          </button>
          <button
            onClick={loadSnippets}
            class="p-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div class="flex-1 flex space-x-4 overflow-hidden">
        {/* Left Column: Snippet List */}
        <div class="w-72 flex flex-col space-y-2 border-r border-border pr-3">
          <div class="relative">
            <Search size={13} class="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search snippets..."
              class="w-full pl-8 pr-2 py-1.5 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div class="flex-1 overflow-y-auto space-y-1.5">
            <For each={filteredSnippets()}>
              {(s) => (
                <div
                  onClick={() => {
                    setSelectedSnippet(s);
                    setIsEditing(false);
                  }}
                  class={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedSnippet()?.id === s.id && !isEditing()
                      ? "bg-primary/10 border-primary text-foreground shadow-sm"
                      : "bg-card border-border hover:bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-foreground truncate">
                      {s.title}
                    </span>
                    <span class="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">
                      {s.language}
                    </span>
                  </div>
                  <p class="text-[11px] text-muted-foreground truncate mt-1">
                    {s.description || s.category}
                  </p>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Right Column: Viewer / Editor */}
        <div class="flex-1 flex flex-col bg-card border border-border rounded-lg p-4 overflow-hidden">
          <Show
            when={isEditing()}
            fallback={
              <Show
                when={selectedSnippet()}
                fallback={
                  <div class="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                    <Code2 size={36} class="opacity-40" />
                    <p class="text-xs">Select a snippet from the left or create a new one.</p>
                  </div>
                }
              >
                {(snip) => (
                  <div class="h-full flex flex-col space-y-3">
                    <div class="flex items-start justify-between border-b border-border pb-3">
                      <div>
                        <h2 class="text-sm font-semibold text-foreground">
                          {snip().title}
                        </h2>
                        <p class="text-xs text-muted-foreground mt-0.5">
                          {snip().description || "No description provided"}
                        </p>
                      </div>

                      <div class="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleToggleFavorite(snip())}
                          class="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                        >
                          <Star
                            size={14}
                            class={snip().is_favorite ? "text-yellow-500 fill-yellow-500" : ""}
                          />
                        </button>
                        <button
                          onClick={() => handleCopy(snip())}
                          class="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/80 flex items-center space-x-1"
                        >
                          {copiedId() === snip().id ? (
                            <Check size={13} class="text-green-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => {
                            setFormData({
                              id: snip().id,
                              title: snip().title,
                              description: snip().description,
                              content: snip().content,
                              language: snip().language,
                              category: snip().category,
                              tags: snip().tags,
                              is_favorite: snip().is_favorite,
                            });
                            setIsEditing(true);
                          }}
                          class="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(snip().id)}
                          class="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div class="flex-1 bg-background border border-input rounded p-3 overflow-auto font-mono text-xs text-foreground whitespace-pre">
                      {snip().content}
                    </div>
                  </div>
                )}
              </Show>
            }
          >
            {/* Editing Form */}
            <div class="h-full flex flex-col space-y-3">
              <div class="flex items-center justify-between border-b border-border pb-2">
                <h2 class="text-xs font-semibold text-foreground">
                  {formData().id ? "Edit Snippet" : "Create New Snippet"}
                </h2>
                <div class="flex space-x-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    class="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    class="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90"
                  >
                    Save Snippet
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData().title}
                    onInput={(e) => setFormData({ ...formData(), title: e.currentTarget.value })}
                    placeholder="e.g. Rust Redb Transaction Boilerplate"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs text-foreground"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                    Language
                  </label>
                  <select
                    value={formData().language}
                    onChange={(e) => setFormData({ ...formData(), language: e.currentTarget.value })}
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs text-foreground uppercase font-mono"
                  >
                    <For each={LANGUAGES}>
                      {(lang) => <option value={lang}>{lang}</option>}
                    </For>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData().description || ""}
                  onInput={(e) => setFormData({ ...formData(), description: e.currentTarget.value })}
                  placeholder="Optional brief summary..."
                  class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs text-foreground"
                />
              </div>

              <div class="flex-1 flex flex-col">
                <label class="block text-[11px] font-medium text-muted-foreground mb-1">
                  Content / Code
                </label>
                <textarea
                  value={formData().content}
                  onInput={(e) => setFormData({ ...formData(), content: e.currentTarget.value })}
                  placeholder="Paste or write snippet content here..."
                  class="flex-1 w-full p-2.5 bg-background border border-input rounded font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
