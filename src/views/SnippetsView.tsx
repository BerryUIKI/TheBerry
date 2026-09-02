import { createSignal, onMount, For, Show } from "solid-js";
import { SnippetItem, SnippetPayload } from "../types/snippets";
import {
  getSnippets,
  saveSnippet,
  deleteSnippet,
  copyExpandedSnippet,
} from "../services/snippets";
import { copyToSystemClipboard } from "../services/clipboard";
import { useToast } from "../context/ToastContext";
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
  Download,
  Upload,
  Eye,
  FileJson,
  X,
} from "lucide-solid";

export function SnippetsView() {
  const { success, error, info } = useToast();
  const [snippets, setSnippets] = createSignal<SnippetItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string>("All");
  const [selectedLanguage, setSelectedLanguage] = createSignal<string>("All");
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [showModal, setShowModal] = createSignal(false);
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [importJsonText, setImportJsonText] = createSignal("");
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
    const q = searchQuery().trim().toLowerCase();
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
      success("Copied to Clipboard", s.title);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      error("Copy Failed", String(e));
    }
  };

  const handleCopyExpanded = async (s: SnippetItem) => {
    try {
      await copyExpandedSnippet(s.content);
      setCopiedId(s.id + "_expanded");
      success("Dynamic Snippet Copied", `${s.title} (variables resolved)`);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      error("Expanded Copy Failed", String(e));
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
      error("Toggle Favorite Failed", String(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSnippet(id);
      success("Snippet Deleted");
      await loadSnippets();
    } catch (e) {
      error("Delete Error", String(e));
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

  const hasUnsavedChanges = () => {
    const data = formData();
    const editing = editingSnippet();
    if (!editing) {
      return data.title.trim().length > 0 || data.content.trim().length > 0;
    }
    return (
      data.title !== editing.title ||
      data.content !== editing.content ||
      (data.description || "") !== (editing.description || "") ||
      (data.language || "typescript") !== (editing.language || "typescript") ||
      (data.category || "General") !== (editing.category || "General")
    );
  };

  const handleCloseModal = () => {
    if (hasUnsavedChanges()) {
      if (typeof window !== "undefined" && window.confirm && !window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        return;
      }
    }
    setShowModal(false);
  };

  const insertVariable = (placeholder: string) => {
    const current = formData().content;
    setFormData({ ...formData(), content: current + placeholder });
  };

  // Real-time live template preview helper
  const computeLivePreview = (text: string) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    const fakeUuid = "e4eaaaf2-d142-11e1-b3e4-080027620cdd";

    return text
      .replace(/\$\{CURRENT_DATE\}/g, dateStr)
      .replace(/\$\{DATE\}/g, dateStr)
      .replace(/\$\{CURRENT_TIME\}/g, timeStr)
      .replace(/\$\{TIME\}/g, timeStr)
      .replace(/\$\{CURRENT_DATETIME\}/g, `${dateStr} ${timeStr}`)
      .replace(/\$\{UUID\}/g, fakeUuid)
      .replace(/\$\{CLIPBOARD_TEXT\}/g, "[Current Clipboard Text]")
      .replace(/\$\{CLIPBOARD\}/g, "[Current Clipboard Text]");
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
      success(editingSnippet() ? "Snippet Updated" : "Snippet Created", data.title);
      await loadSnippets();
    } catch (err) {
      error("Save Error", String(err));
    }
  };

  const handleExportJson = async () => {
    try {
      const data = JSON.stringify(snippets(), null, 2);
      await copyToSystemClipboard(data);
      success("Exported to Clipboard", `${snippets().length} snippets in JSON format`);
    } catch (err) {
      error("Export Failed", String(err));
    }
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText());
      if (!Array.isArray(parsed)) throw new Error("JSON root must be an array of snippets");

      let count = 0;
      for (const item of parsed) {
        if (item.title && item.content) {
          await saveSnippet({
            title: item.title,
            description: item.description || "",
            content: item.content,
            language: item.language || "text",
            category: item.category || "Imported",
            tags: Array.isArray(item.tags) ? item.tags : [],
            is_favorite: Boolean(item.is_favorite),
          });
          count++;
        }
      }

      setShowImportModal(false);
      setImportJsonText("");
      success("Import Completed", `Successfully imported ${count} snippets`);
      await loadSnippets();
    } catch (err: any) {
      error("Import Failed", err.message || "Invalid JSON structure");
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
      content.includes("${CLIPBOARD}") ||
      content.includes("${CLIPBOARD_TEXT}")
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

        <div class="flex items-center space-x-2">
          {/* Export JSON Button */}
          <button
            onClick={handleExportJson}
            title="Export all snippets to JSON on clipboard"
            class="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all border border-border/60 active:scale-95 shadow-xs"
          >
            <Download size={13} class="text-muted-foreground" />
            <span>Export</span>
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => setShowImportModal(true)}
            title="Import snippets from JSON"
            class="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all border border-border/60 active:scale-95 shadow-xs"
          >
            <Upload size={13} class="text-muted-foreground" />
            <span>Import</span>
          </button>

          {/* New Snippet Button */}
          <button
            onClick={handleOpenAdd}
            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
          >
            <Plus size={14} />
            <span>New Snippet</span>
          </button>
        </div>
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
            class="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        <div class="flex items-center space-x-2">
          {/* Category Selector */}
          <select
            value={selectedCategory()}
            onChange={(e) => setSelectedCategory(e.currentTarget.value)}
            class="px-2.5 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none cursor-pointer"
          >
            <For each={categories()}>
              {(cat) => <option value={cat}>Category: {cat}</option>}
            </For>
          </select>

          {/* Language Selector */}
          <select
            value={selectedLanguage()}
            onChange={(e) => setSelectedLanguage(e.currentTarget.value)}
            class="px-2.5 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none cursor-pointer"
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
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-xl">
              <Code size={32} class="opacity-40" />
              <p class="text-xs">No code snippets found. Add your first snippet or template!</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <For each={filteredSnippets()}>
              {(s) => (
                <div class="p-4 bg-card border border-border hover:border-primary/40 rounded-xl flex flex-col justify-between space-y-3 transition-all group shadow-sm hover:shadow-md">
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
                          class="p-1 text-muted-foreground hover:text-foreground rounded transition-transform active:scale-90"
                        >
                          <Star
                            size={13}
                            class={s.is_favorite ? "text-yellow-500 fill-yellow-500" : ""}
                          />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          class="p-1 text-muted-foreground hover:text-destructive rounded transition-transform active:scale-90"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Code Content Block */}
                    <div class="relative bg-background border border-border/80 rounded-lg p-2.5 font-mono text-xs text-foreground/90 max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
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
                        class="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                      >
                        Edit
                      </button>

                      {/* Expand & Copy Button if template */}
                      <Show when={hasTemplateVars(s.content)}>
                        <button
                          onClick={() => handleCopyExpanded(s)}
                          title="Expand template variables and copy to clipboard"
                          class="px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 flex items-center space-x-1 transition-all border border-border active:scale-95"
                        >
                          {copiedId() === s.id + "_expanded" ? (
                            <Check size={12} class="text-emerald-500" />
                          ) : (
                            <Sparkles size={12} class="text-primary" />
                          )}
                          <span>Copy Dynamic</span>
                        </button>
                      </Show>

                      <button
                        onClick={() => handleCopyRaw(s)}
                        class="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center space-x-1 transition-all shadow-xs active:scale-95"
                      >
                        {copiedId() === s.id ? (
                          <Check size={12} class="text-emerald-500" />
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
          class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div class="bg-card border border-border rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-border pb-3">
              <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
                <Code size={16} class="text-primary" />
                <span>{editingSnippet() ? "Edit Snippet" : "New Code Snippet & Template"}</span>
              </h2>
              <button
                onClick={handleCloseModal}
                class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={15} />
              </button>
            </div>

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
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Language</label>
                  <input
                    type="text"
                    value={formData().language || "typescript"}
                    onInput={(e) => setFormData({ ...formData(), language: e.currentTarget.value })}
                    placeholder="typescript, rust, sql, python"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={rawTags()}
                    onInput={(e) => setRawTags(e.currentTarget.value)}
                    placeholder="react, hooks, async"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                  class="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Template Placeholder Helper Chips */}
              <div class="space-y-1">
                <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Code / Template Content:</span>
                  <span class="text-primary font-medium">Insert dynamic placeholders:</span>
                </div>
                <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  {[
                    { label: "${CURRENT_DATE}", code: "${CURRENT_DATE}" },
                    { label: "${CURRENT_TIME}", code: "${CURRENT_TIME}" },
                    { label: "${UUID}", code: "${UUID}" },
                    { label: "${CLIPBOARD_TEXT}", code: "${CLIPBOARD_TEXT}" },
                  ].map((v) => (
                    <button
                      type="button"
                      onClick={() => insertVariable(v.code)}
                      class="px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 text-foreground font-mono text-[10px] transition-colors border border-border active:scale-95"
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
                rows={5}
                class="w-full p-2.5 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />

              {/* Live Preview Box */}
              <Show when={formData().content.trim().length > 0}>
                <div class="p-3 bg-muted/40 border border-border/80 rounded-xl space-y-1.5">
                  <div class="flex items-center space-x-1.5 text-[11px] font-semibold text-foreground/80">
                    <Eye size={12} class="text-primary" />
                    <span>Live Output Preview</span>
                    <Show when={hasTemplateVars(formData().content)}>
                      <span class="text-[10px] px-1.5 rounded bg-primary/20 text-primary font-mono ml-auto">
                        Variables Evaluated
                      </span>
                    </Show>
                  </div>
                  <pre class="font-mono text-[11px] text-muted-foreground bg-background/60 p-2 rounded-lg whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {computeLivePreview(formData().content)}
                  </pre>
                </div>
              </Show>

              <div class="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  class="px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-4 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 shadow-sm active:scale-95"
                >
                  Save Snippet
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* JSON Import Modal */}
      <Show when={showImportModal()}>
        <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div class="bg-card border border-border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div class="flex items-center justify-between border-b border-border pb-3">
              <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
                <FileJson size={16} class="text-primary" />
                <span>Import Snippets from JSON</span>
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={15} />
              </button>
            </div>

            <p class="text-xs text-muted-foreground">
              Paste an exported JSON array of snippets below to import them into your library:
            </p>

            <textarea
              value={importJsonText()}
              onInput={(e) => setImportJsonText(e.currentTarget.value)}
              placeholder="[ { &quot;title&quot;: &quot;...&quot;, &quot;content&quot;: &quot;...&quot; } ]"
              rows={8}
              class="w-full p-2.5 bg-background border border-input rounded-lg font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />

            <div class="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                class="px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                disabled={!importJsonText().trim()}
                class="px-4 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 shadow-sm active:scale-95 disabled:opacity-50"
              >
                Run Import
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
