import { createSignal, onMount, For, Show } from "solid-js";
import { LauncherItem, LauncherPayload } from "../types/launcher";
import {
  getLauncherItems,
  saveLauncherItem,
  deleteLauncherItem,
  launchItem,
} from "../services/launcher";
import {
  Rocket,
  Plus,
  Play,
  Star,
  Trash2,
  Layers,
  Terminal,
  FolderOpen,
  Search,
  CheckCircle2,
} from "lucide-solid";

export function LauncherView() {
  const [items, setItems] = createSignal<LauncherItem[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string>("All");
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [launchMessage, setLaunchMessage] = createSignal<string | null>(null);

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
  const [rawBatchCmds, setRawBatchCmds] = createSignal("");

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

  const handleLaunch = async (item: LauncherItem) => {
    try {
      const msg = await launchItem(item.id);
      setLaunchMessage(msg);
      setTimeout(() => setLaunchMessage(null), 2500);
      await loadItems();
    } catch (e: unknown) {
      alert(`Launch error: ${e instanceof Error ? e.message : String(e)}`);
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
        working_dir: item.working_dir || undefined,
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

  const handleDelete = async (id: string) => {
    if (confirm("Remove this launcher item?")) {
      try {
        await deleteLauncherItem(id);
        await loadItems();
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  const handleSave = async () => {
    const data = formData();
    if (!data.name.trim()) return;
    if (!data.is_batch && !data.exec_path.trim()) return;

    const args = rawArgs()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const batch = rawBatchCmds()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await saveLauncherItem({
        ...data,
        arguments: args,
        batch_commands: batch,
      });
      setShowAddModal(false);
      await loadItems();
    } catch (e) {
      console.error("Save launcher item failed:", e);
    }
  };

  const categories = () => {
    const set = new Set<string>(["All"]);
    items().forEach((i) => set.add(i.category));
    return Array.from(set);
  };

  const filteredItems = () => {
    const q = searchQuery().toLowerCase();
    const cat = selectedCategory();
    return items().filter((i) => {
      const matchCat = cat === "All" || i.category === cat;
      const matchQuery =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.exec_path.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Rocket class="text-primary" size={20} />
            <span>Application Launcher & Batch Organizer</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Quickly trigger apps, multi-instances (e.g. WeChat), scripts, and batch workflows
          </p>
        </div>

        <button
          onClick={() => {
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
            setRawBatchCmds("");
            setShowAddModal(true);
          }}
          class="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 flex items-center space-x-1.5 transition-colors"
        >
          <Plus size={14} />
          <span>Add Program / Script</span>
        </button>
      </div>

      {/* Status banner */}
      <Show when={launchMessage()}>
        <div class="flex items-center space-x-2 p-2 bg-green-500/10 border border-green-500/30 text-green-500 rounded text-xs">
          <CheckCircle2 size={14} />
          <span>{launchMessage()}</span>
        </div>
      </Show>

      {/* Filter Toolbar */}
      <div class="flex items-center space-x-3">
        <div class="relative flex-1">
          <Search size={13} class="absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search programs and batch launchers..."
            class="w-full pl-8 pr-3 py-1.5 bg-card border border-input rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
              <p class="text-xs">No launcher targets configured. Add your first app or batch script!</p>
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={filteredItems()}>
              {(item) => (
                <div class="p-3 bg-card border border-border hover:border-primary/40 rounded-lg transition-all flex flex-col justify-between space-y-3 group">
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
                          <span class="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
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
                      {item.description || item.exec_path || "Custom batch routine"}
                    </p>
                  </div>

                  <div class="flex items-center justify-between pt-2 border-t border-border/50">
                    <span class="text-[10px] text-muted-foreground font-mono">
                      Launched {item.launch_count} times
                    </span>

                    <button
                      onClick={() => handleLaunch(item)}
                      class="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded flex items-center space-x-1 transition-colors"
                    >
                      <Play size={12} class="fill-primary-foreground" />
                      <span>Launch</span>
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Add / Edit Modal */}
      <Show when={showAddModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div class="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden p-5 space-y-4">
            <h2 class="text-sm font-semibold text-foreground flex items-center space-x-2">
              <Rocket size={16} class="text-primary" />
              <span>Configure Launcher Target</span>
            </h2>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={formData().name}
                    onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
                    placeholder="e.g. WeChat Multi-Instance"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground"
                  />
                </div>
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">Category</label>
                  <input
                    type="text"
                    value={formData().category || "Development"}
                    onInput={(e) => setFormData({ ...formData(), category: e.currentTarget.value })}
                    placeholder="e.g. Tools, Social, Dev"
                    class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground"
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
                  class="w-full px-2.5 py-1.5 bg-background border border-input rounded text-foreground"
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
                      <input
                        type="text"
                        value={formData().exec_path}
                        onInput={(e) => setFormData({ ...formData(), exec_path: e.currentTarget.value })}
                        placeholder="e.g. C:\Program Files\App\app.exe or code"
                        class="w-full px-2.5 py-1.5 bg-background border border-input rounded font-mono text-foreground"
                      />
                    </div>
                    <div>
                      <label class="block font-medium text-muted-foreground mb-1">Arguments (one per line)</label>
                      <textarea
                        value={rawArgs()}
                        onInput={(e) => setRawArgs(e.currentTarget.value)}
                        placeholder="--incognito&#10;--profile=dev"
                        rows={2}
                        class="w-full p-2 bg-background border border-input rounded font-mono text-foreground resize-none"
                      />
                    </div>
                  </div>
                }
              >
                <div>
                  <label class="block font-medium text-muted-foreground mb-1">
                    Batch Commands (one command line per line)
                  </label>
                  <textarea
                    value={rawBatchCmds()}
                    onInput={(e) => setRawBatchCmds(e.currentTarget.value)}
                    placeholder="start WeChat.exe&#10;start WeChat.exe"
                    rows={4}
                    class="w-full p-2 bg-background border border-input rounded font-mono text-foreground resize-none"
                  />
                </div>
              </Show>
            </div>

            <div class="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                class="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                class="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
