import { createSignal, onMount, For, Show, JSX } from "solid-js";
import { SearchQuery, SearchResultItem, SystemDrive } from "../types/fileSearch";
import {
  getSystemDrives,
  searchFiles,
  revealInExplorer,
  openFilePath,
} from "../services/fileSearch";
import { copyToSystemClipboard } from "../services/clipboard";
import { useToast } from "../context/ToastContext";
import {
  Search,
  Folder,
  File,
  HardDrive,
  ExternalLink,
  Copy,
  Check,
  Play,
  FileCode,
  FileText,
  FileImage,
  FileArchive,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-solid";

type SortField = "name" | "size" | "path";
type SortOrder = "asc" | "desc";

export function FileSearchView() {
  const { success, error, info } = useToast();
  const [queryText, setQueryText] = createSignal("");
  const [drives, setDrives] = createSignal<SystemDrive[]>([]);
  const [selectedRoot, setSelectedRoot] = createSignal<string>("");
  const [results, setResults] = createSignal<SearchResultItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [fileType, setFileType] = createSignal<SearchQuery["file_type"]>("all");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [copiedPath, setCopiedPath] = createSignal<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = createSignal<SortField>("name");
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("asc");

  const loadDrives = async () => {
    try {
      const list = await getSystemDrives();
      setDrives(list);
      if (list.length > 0 && !selectedRoot()) {
        setSelectedRoot(list[0].mount_point);
      }
    } catch (e) {
      console.warn("Failed to load system drives:", e);
    }
  };

  onMount(() => {
    loadDrives();
  });

  const handleSearch = async (e?: Event) => {
    if (e) e.preventDefault();
    const q = queryText().trim();
    if (!q && !selectedRoot()) return;

    setSearching(true);
    try {
      const list = await searchFiles({
        query: q,
        root_dir: selectedRoot() || undefined,
        case_sensitive: caseSensitive(),
        file_type: fileType(),
        limit: 200,
      });
      setResults(list);
    } catch (err) {
      error("Search Error", String(err));
    } finally {
      setSearching(false);
    }
  };

  const handleOpen = async (item: SearchResultItem) => {
    try {
      await openFilePath(item.path);
      info("Opening File", item.name);
    } catch (err) {
      error("Failed to Open File", String(err));
    }
  };

  const handleReveal = async (path: string) => {
    try {
      await revealInExplorer(path);
      info("Revealed in Explorer", path.split(/[\\/]/).pop() || path);
    } catch (err) {
      error("Reveal Error", String(err));
    }
  };

  const handleCopyPath = async (path: string) => {
    try {
      await copyToSystemClipboard(path);
      setCopiedPath(path);
      success("Path Copied", path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch (err) {
      error("Copy Error", String(err));
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedResults = () => {
    const list = [...results()];
    const field = sortField();
    const order = sortOrder();

    return list.sort((a, b) => {
      let comparison = 0;
      if (field === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (field === "size") {
        comparison = (a.size_bytes || 0) - (b.size_bytes || 0);
      } else if (field === "path") {
        comparison = a.path.localeCompare(b.path);
      }
      return order === "asc" ? comparison : -comparison;
    });
  };

  // Keyword highlighting helper
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "--";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (item: SearchResultItem) => {
    if (item.is_dir) return <Folder size={15} class="text-amber-500 flex-shrink-0" />;
    const ext = item.extension.toLowerCase();
    if (["ts", "tsx", "js", "jsx", "rs", "py", "go", "c", "cpp", "json", "toml"].includes(ext)) {
      return <FileCode size={15} class="text-sky-500 flex-shrink-0" />;
    }
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      return <FileImage size={15} class="text-emerald-500 flex-shrink-0" />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
      return <FileArchive size={15} class="text-purple-500 flex-shrink-0" />;
    }
    if (["txt", "md", "doc", "docx", "pdf"].includes(ext)) {
      return <FileText size={15} class="text-rose-500 flex-shrink-0" />;
    }
    return <File size={15} class="text-muted-foreground flex-shrink-0" />;
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Search class="text-primary" size={20} />
            <span>Fast Everything File Search</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            Instant multi-drive local search, extension filtering, and Explorer reveal
          </p>
        </div>

        {/* Drive Selector */}
        <div class="flex items-center space-x-1.5">
          <For each={drives()}>
            {(d) => (
              <button
                onClick={() => {
                  setSelectedRoot(d.mount_point);
                  handleSearch();
                }}
                class={`px-2.5 py-1 text-xs rounded-lg flex items-center space-x-1.5 transition-all border active:scale-95 ${
                  selectedRoot() === d.mount_point
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-secondary/70"
                }`}
              >
                <HardDrive size={13} />
                <span>{d.name}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} class="flex items-center space-x-2">
        <div class="relative flex-1">
          <Search size={14} class="absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={queryText()}
            onInput={(e) => setQueryText(e.currentTarget.value)}
            placeholder="Type filename or wildcard (e.g. *.rs, main.tsx, report)..."
            class="w-full pl-9 pr-3 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        {/* Category Filter */}
        <select
          value={fileType()}
          onChange={(e) => {
            setFileType(e.currentTarget.value as SearchQuery["file_type"]);
            handleSearch();
          }}
          class="px-2.5 py-1.5 bg-card border border-input rounded-lg text-xs text-foreground focus:outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="files">Files Only</option>
          <option value="folders">Folders Only</option>
          <option value="code">Code Files</option>
          <option value="documents">Documents</option>
          <option value="images">Images</option>
          <option value="archives">Archives</option>
        </select>

        <button
          type="submit"
          disabled={searching()}
          class="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center space-x-1.5 transition-all shadow-xs disabled:opacity-50 active:scale-95"
        >
          <span>{searching() ? "Searching..." : "Search"}</span>
        </button>
      </form>

      {/* Results Header & Sort Controls */}
      <Show when={results().length > 0 || searching()}>
        <div class="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div class="flex items-center space-x-3">
            <span>
              {searching() ? "Scanning file system..." : `Found ${results().length} results`}
            </span>
            <span class="text-[11px] font-mono">Scope: {selectedRoot() || "All Drives"}</span>
          </div>

          <div class="flex items-center space-x-2 text-[11px]">
            <span class="text-muted-foreground">Sort:</span>
            <button
              onClick={() => toggleSort("name")}
              class={`flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-secondary ${
                sortField() === "name" ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              <span>Name</span>
              {sortField() === "name" && (sortOrder() === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
            <button
              onClick={() => toggleSort("size")}
              class={`flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-secondary ${
                sortField() === "size" ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              <span>Size</span>
              {sortField() === "size" && (sortOrder() === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
          </div>
        </div>
      </Show>

      {/* Results Table */}
      <div class="flex-1 overflow-y-auto border border-border rounded-xl bg-card/50 shadow-xs">
        <Show
          when={sortedResults().length > 0}
          fallback={
            <div class="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <Search size={32} class="opacity-40" />
              <p class="text-xs">
                {searching() ? "Traversing local drives..." : "Enter a search query to locate files and folders instantly"}
              </p>
            </div>
          }
        >
          <div class="divide-y divide-border/40 text-xs">
            <For each={sortedResults()}>
              {(item) => (
                <div
                  onDblClick={() => handleOpen(item)}
                  class="px-3.5 py-2.5 flex items-center justify-between hover:bg-secondary/50 transition-colors group cursor-pointer"
                >
                  <div class="flex items-center space-x-3 min-w-0 flex-1">
                    {getFileIcon(item)}
                    <div class="min-w-0 flex-1">
                      <p class="font-medium text-foreground truncate">
                        {renderHighlighted(item.name, queryText())}
                      </p>
                      <p class="text-[11px] text-muted-foreground font-mono truncate">
                        {renderHighlighted(item.path, queryText())}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center space-x-3 flex-shrink-0 ml-3">
                    <span class="text-[11px] text-muted-foreground font-mono w-16 text-right">
                      {formatSize(item.size_bytes)}
                    </span>

                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpen(item)}
                        title="Open File"
                        class="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                      >
                        <Play size={13} />
                      </button>
                      <button
                        onClick={() => handleReveal(item.path)}
                        title="Reveal in File Explorer"
                        class="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        onClick={() => handleCopyPath(item.path)}
                        title="Copy Full Path"
                        class="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                      >
                        {copiedPath() === item.path ? (
                          <Check size={13} class="text-emerald-500" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
