import { createSignal, onMount, For, Show } from "solid-js";
import { SnippetItem, SnippetPayload } from "../types/snippets";
import {
  getSnippets,
  saveSnippet,
  deleteSnippet,
  copyExpandedSnippet,
} from "../services/snippets";
import { copyToSystemClipboard } from "../services/clipboard";
import {
  Code,
  Plus,
  Trash2,
  Star,
  Copy,
  Check,
  Search,
  Tag,
  Sparkles,
  Layers,
} from "lucide-solid";

export function SnippetsView() {
  const [snippets, setSnippets] = createSignal<SnippetItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string>("All");
  const [selectedLanguage, setSelectedLanguage] = createSignal<string>("All");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [showModal, setShowModal] = createSignal(false);
  const [editingSnippet, setEditingSnippet] = createSignal<SnippetItem | null>(null);

  // Form State
  const [formData, setFormData] = createSignal<SnippetPayload>({
    title: "",
    description: "",
    content: "",
    language: "typescript",
    category: "General",
    tags: [],
    is_favorite: false,
  });
  const [rawTags, setRawTags] = createSignal("");

  const loadSnippets = async () => {
    try {
      const list = await getSnippets();
      setSnippets(list);
    } catch (e) {
      console.warn("Failed to load snippets:", e);
    }
  };

  onMount(() => {
    loadSnippets();
  });

  const categories = () => {
    const set = new Set<string>(["All"]);
    snippets().forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  };

  const languages = () => {
    const set = new Set<string>(["All"]);
    snippets().forEach((s) => {
      if (s.language) set.add(s.language);
    });
    return Array.from(set);
  };

  const filteredSnippets = () => {
    const q = searchQuery().toLowerCase();
    const cat = selectedCategory();
    const lang = selectedLanguage();

    return snippets().filter((s) => {
      const matchesSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));

      const matchesCat = cat === "All" || s.category === cat;
      const matchesLang = lang === "All" || s.language === lang;

      return matchesSearch && matchesCat && matchesLang;
    });
  };

  const handleCopyRaw = async (s: SnippetItem) => {
    try {
      await copyToSystemClipboard(s.content);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleCopyExpanded = async (s: SnippetItem) => {
    try {
      await copyExpandedSnippet(s.content);
      setCopiedId(s.id + "_expanded");
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      console.error("Expanded copy failed:", e);
    }
  };

  const handleToggleFavorite = async (s: SnippetItem) => {
    try {
      await saveSnippet({
        id: s.id,
        title: s.title,
        description: s.description,
        content: s.content,
        language: s.language,
        category: s.category,
        tags: s.tags,
        is_favorite: !s.is_favorite,
      });
      await loadSnippets();
    } catch (e) {
      console.error("Toggle favorite error:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this code snippet?")) {
      try {
        await deleteSnippet(id);
        await loadSnippets();
      } catch (e) {
        console.error("Delete error:", e);
      }
    }
  };

  const handleOpenAdd = () => {
    setEditingSnippet(null);
    setFormData({
      title: "",
      description: "",
      content: "",
      language: "typescript",
      category: "General",
      tags: [],
      is_favorite: false,
    });
    setRawTags("");
    setShowModal(true);
  };

  const handleOpenEdit = (s: SnippetItem) => {
    setEditingSnippet(s);
    setFormData({
      id: s.id,
      title: s.title,
      description: s.description,
      content: s.content,
      language: s.language,
      category: s.category,
      tags: s.tags,
      is_favorite: s.is_favorite,
    });
    setRawTags(s.tags.join(", "));
    setShowModal(true);
  };

  const insertVariable = (placeholder: string) => {
    const current = formData().content;
    setFormData({ ...formData(), content: current + placeholder });
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const data = formData();
    if (!data.title.trim() || !data.content.trim()) return;

    const parsedTags = rawTags()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await saveSnippet({
        ...data,
        tags: parsedTags,
      });
      setShowModal(false);
      await loadSnippets();
    } catch (err) {
      console.error("Save error:", err);
      alert(`Save error: ${err}`);
    }
  };

  const hasTemplateVars = (content: string) => {
    return (
      content.includes("${CURRENT_DATE}") ||
      content.includes("${DATE}") ||
      content.includes("${CURRENT_TIME}") ||
      content.includes("${TIME}") ||
      content.includes("${CURRENT_DATETIME}") ||
      content.includes("${UUID}") ||
      content.includes("${CLIPBOARD}")
    );
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Code class="text-primary" size={20} />
            <span>Code & Text Snippet Library</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Organize reusable code blocks, dynamic templates, SQL queries, and regexes
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Plus size={14} />
          <span>New Snippet</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div class="flex items-center space-x-3">
        <div class="relative flex-1">
          <Search size={14} class="absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search snippets by title, content, or tags..."
            class="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>

        <div class="flex items-center space-x-2">
          {/* Category Selector */}
          <select
            value={selectedCategory()}
            onChange={(e) => setSelectedCategory(e.currentTarget.value)}
            class="px-2.5 py-1.5 bg-card border border-input rounded-md text-xs text-foreground focus:outline-none cursor-pointer"
          >
            <For each={categories()}>
              {(cat) => <option value={cat}>Category: {cat}</option>}
            </For>
          </select>

          {/* Language Selector */}
          <select
            value={selectedLanguage()}
            onChange={(e) => setSelectedLanguage(e.currentTarget.value)}
            class="px-2.5 py-1.5 bg-card border border-input rounded-md text-xs text-foreground focus:outline-none cursor-pointer"
          >
            <For each={languages()}>
              {(lang) => <option value={lang}>Language: {lang}</option>}
            </For>
          </select>
        </div>
      </div>

      {/* Snippet Grid */}
      <div class="flex-1 overflow-y-auto pr-1">
        <Show
          when={filteredSnippets().length > 0}
          fallback={
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-lg">
              <Code size={32} class="opacity-40" />
              <p class="text-xs">No code snippets found. Add your first snippet or template!</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <For each={filteredSnippets()}>
              {(s) => (
                <div class="p-4 bg-card border border-border hover:border-primary/40 rounded-lg flex flex-col justify-between space-y-3 transition-all group shadow-sm">
                  <div class="space-y-2">
                    {/* Card Header */}
                    <div class="flex items-start justify-between">
                      <div class="min-w-0">
                        <div class="flex items-center space-x-2">
                          <h3 class="text-xs font-semibold text-foreground truncate">
                            {s.title}
                          </h3>
                          <span class="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                            {s.language}
                          </span>
                          <Show when={hasTemplateVars(s.content)}>
                            <span class="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium flex items-center space-x-0.5">
                              <Sparkles size={9} />
                              <span>Template</span>
                            </span>
                          </Show>
                        </div>
                        <Show when={s.description}>
                          <p class="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {s.description}
                          </p>
                        </Show>
                      </div>

                      <div class="flex items-center space-x-1">
                        <button
                          onClick={() => handleToggleFavorite(s)}
                          class="p-1 text-muted-foreground hover:text-foreground rounded"
                        >
                          <Star
                            size={13}
                            class={s.is_favorite ? "text-yellow-500 fill-yellow-500" : ""}
                          />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          class="p-1 text-muted-foreground hover:text-destructive rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Code Content Block */}
                    <div class="relative bg-background border border-border/80 rounded p-2.5 font-mono text-xs text-foreground/90 max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
                      {s.content}
                    </div>

                    {/* Tags */}
                    <Show when={s.tags.length > 0}>
                      <div class="flex items-center space-x-1.5 flex-wrap">
                        <Tag size={10} class="text-muted-foreground" />
                        <For each={s.tags}>
                          {(t) => (
                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                              {t}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>

                  {/* Card Footer Actions */}
                  <div class="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span class="text-[10px] text-muted-foreground">
                      Category: <span class="font-medium text-foreground">{s.category}</span>
                    </span>

                    <div class="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        class="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors"
                      >
                        Edit
                      </button>

                      {/* Expand & Copy Button if template */}
                      <Show when={hasTemplateVars(s.content)}>
                        <button
                          onClick={() => handleCopyExpanded(s)}
                          title="Expand template variables and copy to clipboard"
                          class="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded hover:bg-secondary/80 flex items-center space-x-1 transition-colors border border-border"
                        >
                          {copiedId() === s.id + "_expanded" ? (
                            <Check size={12} class="text-green-500" />
                          ) : (
                            <Sparkles size={12} class="text-primary" />
                          )}
                          <span>Copy Dynamic</span>
                        </button>
                      </Show>

                      <button
                        onClick={() => handleCopyRaw(s)}
                        class="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 flex items-center space-x-1 transition-colors shadow-sm"
                      >
                        {copiedId() === s.id ? (
                          <Check size={12} class="text-green-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add / Edit Modal */}
      <Show when={showModal()}>
        <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-card border border-border rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <h2 class="text-sm font-bold text-foreground">
              {editingSnippet() ? "Edit Snippet" : "New Code Snippet & Template"}
            </h2>

            <form onSubmit={handleSave} class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData().title}
                    onInput={(e) => setFormData({ ...formData(), title: e.currentTarget.value })}
                    placeholder="e.g. React useAsync Hook"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Language</label>
                  <input
                    type="text"
                    value={formData().language || "typescript"}
                    onInput={(e) => setFormData({ ...formData(), language: e.currentTarget.value })}
                    placeholder="typescript, rust, sql, python"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Category</label>
                  <input
                    type="text"
                    value={formData().category || "General"}
                    onInput={(e) => setFormData({ ...formData(), category: e.currentTarget.value })}
                    placeholder="e.g. Frontend, DB, DevOps"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={rawTags()}
                    onInput={(e) => setRawTags(e.currentTarget.value)}
                    placeholder="react, hooks, async"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label class="block font-medium text-muted-foreground mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={formData().description || ""}
                  onInput={(e) => setFormData({ ...formData(), description: e.currentTarget.value })}
                  placeholder="Brief summary or usage instructions"
                  class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Template Placeholder Helper Chips */}
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Code / Template Content:</span>
                  <span>Insert dynamic placeholders:</span>
                </div>
                <div class="flex items-center space-x-1.5 flex-wrap">
                  {[
                    { label: "${CURRENT_DATE}", code: "${CURRENT_DATE}" },
                    { label: "${CURRENT_TIME}", code: "${CURRENT_TIME}" },
                    { label: "${UUID}", code: "${UUID}" },
                    { label: "${CLIPBOARD_TEXT}", code: "${CLIPBOARD_TEXT}" },
                  ].map((v) => (
                    <button
                      type="button"
                      onClick={() => insertVariable(v.code)}
                      class="px-1.5 py-0.5 rounded bg-muted hover:bg-primary/20 text-foreground font-mono text-[10px] transition-colors border border-border"
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                required
                value={formData().content}
                onInput={(e) => setFormData({ ...formData(), content: e.currentTarget.value })}
                placeholder="Paste code or template content here..."
                rows={6}
                class="w-full p-2.5 bg-background border border-input rounded font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />

              <div class="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  class="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-4 py-1.5 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 shadow-sm"
                >
                  Save Snippet
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
