import { createSignal, onMount, For, Show } from "solid-js";
import { DiscoveredApp, LauncherItem, LauncherPayload } from "../types/launcher";
import {
  getLauncherItems,
  saveLauncherItem,
  deleteLauncherItem,
  launchItem,
  discoverSystemApps,
  batchImportLauncherItems,
} from "../services/launcher";
import {
  Rocket,
  Play,
  Plus,
  Trash2,
  Star,
  Search,
  Terminal,
  FolderOpen,
  Layers,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  X,
} from "lucide-solid";

export function LauncherView() {
  const [items, setItems] = createSignal<LauncherItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string>("All");
  const [showModal, setShowModal] = createSignal(false);
  const [editingItem, setEditingItem] = createSignal<LauncherItem | null>(null);

  // Form state
  const [formData, setFormData] = createSignal<LauncherPayload>({
    name: "",
    description: "",
    exec_path: "",
    arguments: [],
    working_dir: "",
    category: "Development",
    is_favorite: false,
    is_batch: false,
    batch_commands: [],
  });

  const [rawArgs, setRawArgs] = createSignal("");
  const [rawBatchCommands, setRawBatchCommands] = createSignal("");

  // App Discovery state
  const [showDiscoveryModal, setShowDiscoveryModal] = createSignal(false);
  const [discoveredApps, setDiscoveredApps] = createSignal<DiscoveredApp[]>([]);
  const [discoverySearch, setDiscoverySearch] = createSignal("");
  const [selectedApps, setSelectedApps] = createSignal<Set<string>>(new Set());
  const [scanning, setScanning] = createSignal(false);
  const [importSuccessMessage, setImportSuccessMessage] = createSignal<string | null>(null);

  const loadItems = async () => {
    try {
      const list = await getLauncherItems();
      setItems(list);
    } catch (e) {
      console.warn("Failed to load launcher items:", e);
    }
  };

  onMount(() => {
    loadItems();
  });

  const categories = () => {
    const set = new Set<string>(["All"]);
    items().forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  };

  const filteredItems = () => {
    const q = searchQuery().toLowerCase();
    const cat = selectedCategory();

    return items().filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesCat = cat === "All" || item.category === cat;
      return matchesSearch && matchesCat;
    });
  };

  const handleLaunch = async (id: string) => {
    try {
      await launchItem(id);
      await loadItems();
    } catch (e) {
      console.error("Launch failed:", e);
      alert(`Launch error: ${e}`);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      exec_path: "",
      arguments: [],
      working_dir: "",
      category: "Development",
      is_favorite: false,
      is_batch: false,
      batch_commands: [],
    });
    setRawArgs("");
    setRawBatchCommands("");
    setShowModal(true);
  };

  const handleOpenEdit = (item: LauncherItem) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      name: item.name,
      description: item.description,
      exec_path: item.exec_path,
      arguments: item.arguments,
      working_dir: item.working_dir,
      category: item.category,
      is_favorite: item.is_favorite,
      is_batch: item.is_batch,
      batch_commands: item.batch_commands,
    });
    setRawArgs((item.arguments || []).join("\n"));
    setRawBatchCommands((item.batch_commands || []).join("\n"));
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this launcher item?")) {
      try {
        await deleteLauncherItem(id);
        await loadItems();
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  const handleToggleFavorite = async (item: LauncherItem) => {
    try {
      await saveLauncherItem({
        id: item.id,
        name: item.name,
        description: item.description,
        exec_path: item.exec_path,
        arguments: item.arguments,
        working_dir: item.working_dir,
        category: item.category,
        is_favorite: !item.is_favorite,
        is_batch: item.is_batch,
        batch_commands: item.batch_commands,
      });
      await loadItems();
    } catch (e) {
      console.error("Toggle favorite failed:", e);
    }
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const data = formData();
    if (!data.name.trim()) return;

    const parsedArgs = rawArgs()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedBatch = rawBatchCommands()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await saveLauncherItem({
        ...data,
        arguments: parsedArgs,
        batch_commands: parsedBatch,
      });
      setShowModal(false);
      await loadItems();
    } catch (err) {
      console.error("Save error:", err);
      alert(`Save error: ${err}`);
    }
  };

  // App Discovery handlers
  const handleStartDiscovery = async () => {
    setScanning(true);
    setShowDiscoveryModal(true);
    try {
      const apps = await discoverSystemApps();
      setDiscoveredApps(apps);
      // Pre-select all by default
      const initialSelected = new Set<string>();
      apps.forEach((a) => initialSelected.add(a.exec_path));
      setSelectedApps(initialSelected);
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelectApp = (path: string) => {
    const current = new Set(selectedApps());
    if (current.has(path)) {
      current.delete(path);
    } else {
      current.add(path);
    }
    setSelectedApps(current);
  };

  const handleSelectAllApps = (select: boolean) => {
    if (select) {
      const all = new Set<string>();
      filteredDiscoveredApps().forEach((a) => all.add(a.exec_path));
      setSelectedApps(all);
    } else {
      setSelectedApps(new Set());
    }
  };

  const filteredDiscoveredApps = () => {
    const q = discoverySearch().toLowerCase();
    return discoveredApps().filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  };

  const handleBatchImport = async () => {
    const toImport = discoveredApps().filter((a) => selectedApps().has(a.exec_path));
    if (toImport.length === 0) return;

    try {
      const count = await batchImportLauncherItems(toImport);
      setShowDiscoveryModal(false);
      await loadItems();
      setImportSuccessMessage(`Successfully imported ${count} applications!`);
      setTimeout(() => setImportSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Import error:", err);
      alert(`Import error: ${err}`);
    }
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Rocket class="text-primary" size={20} />
            <span>App Launcher & Organizer</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Quick-launch apps, custom command flags, and multi-instance batch workflows
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <button
            onClick={handleStartDiscovery}
            class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-md flex items-center space-x-1.5 transition-colors border border-border"
          >
            <Sparkles size={14} class="text-amber-500" />
            <span>Scan Installed Apps</span>
          </button>
          <button
            onClick={handleOpenAdd}
            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>Add Target</span>
          </button>
        </div>
      </div>

      {/* Success banner */}
      <Show when={importSuccessMessage()}>
        <div class="p-2.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-md text-xs flex items-center space-x-2">
          <Check size={14} />
          <span>{importSuccessMessage()}</span>
        </div>
      </Show>

      {/* Search & Category Filter */}
      <div class="flex items-center space-x-3">
        <div class="relative flex-1">
          <Search size={14} class="absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search targets or categories..."
            class="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>

        <div class="flex items-center space-x-1 overflow-x-auto">
          <For each={categories()}>
            {(cat) => (
              <button
                onClick={() => setSelectedCategory(cat)}
                class={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  selectedCategory() === cat
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Grid of Launcher Items */}
      <div class="flex-1 overflow-y-auto pr-1">
        <Show
          when={filteredItems().length > 0}
          fallback={
            <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2 border border-dashed border-border rounded-lg">
              <Rocket size={32} class="opacity-40" />
              <p class="text-xs">No launcher targets configured. Add your first app or click "Scan Installed Apps"!</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={filteredItems()}>
              {(item) => (
                <div class="p-3 bg-card border border-border hover:border-primary/40 rounded-lg transition-all flex flex-col justify-between space-y-3 group shadow-sm">
                  <div class="space-y-1.5">
                    <div class="flex items-start justify-between">
                      <div class="flex items-center space-x-2">
                        <div class="w-7 h-7 rounded bg-secondary flex items-center justify-center text-primary">
                          {item.is_batch ? <Layers size={14} /> : <Terminal size={14} />}
                        </div>
                        <div class="min-w-0">
                          <h3 class="text-xs font-semibold text-foreground truncate">
                            {item.name}
                          </h3>
                          <span class="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      <div class="flex items-center space-x-1">
                        <button
                          onClick={() => handleToggleFavorite(item)}
                          class="p-1 text-muted-foreground hover:text-foreground rounded"
                        >
                          <Star
                            size={13}
                            class={item.is_favorite ? "text-yellow-500 fill-yellow-500" : ""}
                          />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          class="p-1 text-muted-foreground hover:text-destructive rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p class="text-[11px] text-muted-foreground line-clamp-2">
                      {item.description || item.exec_path}
                    </p>
                  </div>

                  <div class="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span class="text-[10px] text-muted-foreground font-mono">
                      Launched {item.launch_count}x
                    </span>

                    <div class="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        class="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded hover:bg-secondary transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleLaunch(item.id)}
                        class="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 flex items-center space-x-1 transition-colors shadow-sm"
                      >
                        <Play size={11} />
                        <span>Run</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add / Edit Target Modal */}
      <Show when={showModal()}>
        <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-card border border-border rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h2 class="text-sm font-bold text-foreground">
              {editingItem() ? "Edit Launcher Target" : "Add Launcher Target"}
            </h2>

            <form onSubmit={handleSave} class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData().name}
                    onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
                    placeholder="e.g. VS Code, WeChat"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Category</label>
                  <input
                    type="text"
                    value={formData().category || "Development"}
                    onInput={(e) => setFormData({ ...formData(), category: e.currentTarget.value })}
                    placeholder="e.g. Tools, Dev"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label class="block font-medium text-muted-foreground mb-1">Description</label>
                <input
                  type="text"
                  value={formData().description || ""}
                  onInput={(e) => setFormData({ ...formData(), description: e.currentTarget.value })}
                  placeholder="Optional note or purpose"
                  class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_batch"
                  checked={formData().is_batch}
                  onChange={(e) => setFormData({ ...formData(), is_batch: e.currentTarget.checked })}
                  class="rounded"
                />
                <label for="is_batch" class="font-medium text-foreground cursor-pointer">
                  Is Batch Script / Multi-Command Pipeline?
                </label>
              </div>

              <Show
                when={formData().is_batch}
                fallback={
                  <div class="space-y-2">
                    <div>
                      <label class="block font-medium text-muted-foreground mb-1">Executable Path</label>
                      <div class="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={formData().exec_path}
                          onInput={(e) => setFormData({ ...formData(), exec_path: e.currentTarget.value })}
                          placeholder="e.g. C:\Program Files\App\app.exe or code"
                          class="flex-1 px-2.5 py-1.5 bg-background border border-input rounded font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { open } = await import("@tauri-apps/plugin-dialog");
                              const selected = await open({
                                multiple: false,
                                filters: [
                                  {
                                    name: "Executables & Scripts",
                                    extensions: ["exe", "bat", "cmd", "ps1", "lnk", "vbs"],
                                  },
                                  { name: "All Files", extensions: ["*"] },
                                ],
                              });
                              if (selected && typeof selected === "string") {
                                setFormData({ ...formData(), exec_path: selected });
                                if (!formData().name) {
                                  const name = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "";
                                  setFormData({ ...formData(), exec_path: selected, name });
                                }
                              }
                            } catch (err) {
                              console.warn("Picker error:", err);
                            }
                          }}
                          class="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded text-xs flex items-center space-x-1 font-medium"
                        >
                          <FolderOpen size={13} />
                          <span>Browse</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="block font-medium text-muted-foreground mb-1">Arguments (one per line)</label>
                      <textarea
                        value={rawArgs()}
                        onInput={(e) => setRawArgs(e.currentTarget.value)}
                        placeholder="--incognito&#10;--profile=dev"
                        rows={2}
                        class="w-full p-2 bg-background border border-input rounded font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                }
              >
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">
                    Batch Commands (one command per line)
                  </label>
                  <textarea
                    value={rawBatchCommands()}
                    onInput={(e) => setRawBatchCommands(e.currentTarget.value)}
                    placeholder="start &quot;&quot; &quot;C:\WeChat\WeChat.exe&quot;&#10;start &quot;&quot; &quot;C:\WeChat\WeChat.exe&quot;"
                    rows={4}
                    class="w-full p-2 bg-background border border-input rounded font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">
                    Commands execute sequentially via system shell.
                  </p>
                </div>
              </Show>

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
                  class="px-4 py-1.5 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Installed Apps Discovery Modal */}
      <Show when={showDiscoveryModal()}>
        <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div class="bg-card border border-border rounded-lg max-w-2xl w-full h-[75vh] flex flex-col p-5 space-y-4 shadow-2xl">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
                  <Sparkles size={16} class="text-amber-500" />
                  <span>Discovered Installed Applications</span>
                </h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Found {discoveredApps().length} applications from your Windows Start Menu
                </p>
              </div>
              <button
                onClick={() => setShowDiscoveryModal(false)}
                class="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter and Select Bar */}
            <div class="flex items-center justify-between space-x-2 text-xs">
              <div class="relative flex-1">
                <Search size={13} class="absolute left-2.5 top-2 text-muted-foreground" />
                <input
                  type="text"
                  value={discoverySearch()}
                  onInput={(e) => setDiscoverySearch(e.currentTarget.value)}
                  placeholder="Filter discovered apps..."
                  class="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div class="flex items-center space-x-2">
                <button
                  onClick={() => handleSelectAllApps(true)}
                  class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAllApps(false)}
                  class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* List */}
            <div class="flex-1 overflow-y-auto border border-border rounded divide-y divide-border/40">
              <Show
                when={!scanning()}
                fallback={
                  <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                    <Sparkles size={24} class="animate-spin text-amber-500" />
                    <p class="text-xs">Scanning Start Menu directories...</p>
                  </div>
                }
              >
                <For each={filteredDiscoveredApps()}>
                  {(app) => (
                    <div
                      onClick={() => toggleSelectApp(app.exec_path)}
                      class="px-3 py-2 flex items-center justify-between hover:bg-secondary/40 cursor-pointer transition-colors group text-xs"
                    >
                      <div class="flex items-center space-x-2.5 min-w-0">
                        <button class="text-primary flex-shrink-0">
                          {selectedApps().has(app.exec_path) ? (
                            <CheckSquare size={15} class="text-primary" />
                          ) : (
                            <Square size={15} class="text-muted-foreground" />
                          )}
                        </button>
                        <div class="min-w-0">
                          <p class="font-medium text-foreground truncate">{app.name}</p>
                          <p class="text-[10px] text-muted-foreground font-mono truncate">
                            {app.exec_path}
                          </p>
                        </div>
                      </div>
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium flex-shrink-0 ml-2">
                        {app.category}
                      </span>
                    </div>
                  )}
                </For>
              </Show>
            </div>

            {/* Footer */}
            <div class="flex items-center justify-between pt-2 border-t border-border">
              <span class="text-xs text-muted-foreground">
                {selectedApps().size} of {discoveredApps().length} selected
              </span>

              <div class="flex items-center space-x-2">
                <button
                  onClick={() => setShowDiscoveryModal(false)}
                  class="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  disabled={selectedApps().size === 0}
                  onClick={handleBatchImport}
                  class="px-4 py-1.5 bg-primary text-primary-foreground font-medium text-xs rounded hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Import Selected ({selectedApps().size})
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
