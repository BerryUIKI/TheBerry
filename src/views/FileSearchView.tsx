import { createSignal, For, Show } from "solid-js";
import { SearchQuery, SearchResultItem } from "../types/fileSearch";
import { searchFiles } from "../services/fileSearch";
import {
  Search,
  Folder,
  File,
  FileCode,
  FileText,
  FileImage,
  FolderOpen,
  Copy,
  Check,
  ExternalLink,
} from "lucide-solid";

export function FileSearchView() {
  const [pattern, setPattern] = createSignal("");
  const [searchRoot, setSearchRoot] = createSignal("");
  const [filterType, setFilterType] = createSignal<SearchQuery["file_type_filter"]>("all");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [results, setResults] = createSignal<SearchResultItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [copiedPath, setCopiedPath] = createSignal<string | null>(null);

  const handleSearch = async () => {
    const p = pattern().trim();
    if (!p) return;

    setSearching(true);
    try {
      const res = await searchFiles({
        pattern: p,
        search_root: searchRoot().trim() || undefined,
        max_results: 250,
        file_type_filter: filterType(),
        case_sensitive: caseSensitive(),
      });
      setResults(res);
    } catch (e: unknown) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  const handlePickRoot = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Directory to Search",
      });
      if (selected && typeof selected === "string") {
        setSearchRoot(selected);
      }
    } catch (e) {
      console.warn("Picker not available:", e);
    }
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch (e) {
      console.error("Copy path failed:", e);
    }
  };

  const handleOpenPath = async (path: string) => {
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    } catch (e) {
      console.warn("Opener failed:", e);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "-";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (item: SearchResultItem) => {
    if (item.is_dir) return <Folder size={14} class="text-yellow-500" />;
    const ext = item.extension;
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))
      return <FileImage size={14} class="text-rose-500" />;
    if (["rs", "ts", "js", "py", "go", "cpp", "json"].includes(ext))
      return <FileCode size={14} class="text-blue-500" />;
    if (["md", "txt", "pdf", "docx"].includes(ext))
      return <FileText size={14} class="text-emerald-500" />;
    return <File size={14} class="text-muted-foreground" />;
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Search class="text-primary" size={20} />
            <span>Everything Fast File Search</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            High-speed local file indexing & instant wildcard search in Rust
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <div class="relative flex-1">
            <Search size={15} class="absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={pattern()}
              onInput={(e) => {
                setPattern(e.currentTarget.value);
                if (e.currentTarget.value.length >= 2) {
                  handleSearch();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Type filename, extension, or pattern to search immediately..."
              class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-md text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>

          <button
            onClick={handleSearch}
            class="px-4 py-2 bg-primary text-primary-foreground font-medium text-xs rounded-md hover:bg-primary/90 transition-colors"
          >
            {searching() ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Filter Toolbar */}
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <div class="flex items-center space-x-2">
            <span class="font-medium text-foreground">Filter:</span>
            {(
              [
                { id: "all", label: "All" },
                { id: "file", label: "Files" },
                { id: "dir", label: "Folders" },
                { id: "code", label: "Code" },
                { id: "image", label: "Images" },
                { id: "doc", label: "Docs" },
              ] as const
            ).map((f) => (
              <button
                onClick={() => {
                  setFilterType(f.id);
                  if (pattern().trim()) handleSearch();
                }}
                class={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  filterType() === f.id
                    ? "bg-secondary text-foreground font-semibold"
                    : "hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div class="flex items-center space-x-3">
            <label class="flex items-center space-x-1.5 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={caseSensitive()}
                onChange={(e) => {
                  setCaseSensitive(e.currentTarget.checked);
                  if (pattern().trim()) handleSearch();
                }}
                class="rounded"
              />
              <span>Match Case</span>
            </label>

            <div class="flex items-center space-x-1">
              <span class="text-[11px]">Root:</span>
              <span class="text-[11px] font-mono text-foreground truncate max-w-[150px]">
                {searchRoot() ? searchRoot().split(/[\\/]/).pop() : "User Home"}
              </span>
              <button
                onClick={handlePickRoot}
                title="Change Search Root"
                class="p-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
              >
                <FolderOpen size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div class="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
        <div class="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span class="w-1/2">Name & Path</span>
          <span class="w-24 text-right">Size</span>
          <span class="w-36 text-right">Modified</span>
          <span class="w-16 text-right">Actions</span>
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-border/40">
          <Show
            when={results().length > 0}
            fallback={
              <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <Search size={32} class="opacity-40" />
                <p class="text-xs">
                  {searching()
                    ? "Searching directory..."
                    : pattern()
                    ? "No files matched your search."
                    : "Enter a search query above to find files across your system."}
                </p>
              </div>
            }
          >
            <For each={results()}>
              {(item) => (
                <div class="px-3 py-1.5 hover:bg-secondary/40 flex items-center justify-between text-xs transition-colors group">
                  <div class="w-1/2 flex items-center space-x-2 min-w-0 pr-2">
                    {getFileIcon(item)}
                    <div class="min-w-0">
                      <p class="font-medium text-foreground truncate">{item.name}</p>
                      <p class="text-[10px] text-muted-foreground font-mono truncate">
                        {item.path}
                      </p>
                    </div>
                  </div>

                  <span class="w-24 text-right font-mono text-[11px] text-muted-foreground">
                    {formatSize(item.size_bytes)}
                  </span>

                  <span class="w-36 text-right text-[11px] text-muted-foreground font-mono">
                    {item.modified_time > 0
                      ? new Date(item.modified_time * 1000).toLocaleString()
                      : "-"}
                  </span>

                  <div class="w-16 flex items-center justify-end space-x-1">
                    <button
                      onClick={() => handleCopyPath(item.path)}
                      title="Copy Full Path"
                      class="p-1 text-muted-foreground hover:text-foreground rounded"
                    >
                      {copiedPath() === item.path ? (
                        <Check size={13} class="text-green-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenPath(item.path)}
                      title="Open in System Explorer"
                      class="p-1 text-muted-foreground hover:text-foreground rounded"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}
