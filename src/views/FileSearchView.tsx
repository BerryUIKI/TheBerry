import { createSignal, onMount, For, Show } from "solid-js";
import { SearchQuery, SearchResultItem } from "../types/fileSearch";
import { searchFiles, getSystemDrives, revealInExplorer, SystemDrive } from "../services/fileSearch";
import {
  Search,
  Folder,
  File,
  FileCode,
  FileText,
  FileImage,
  Copy,
  Check,
  ExternalLink,
  HardDrive,
} from "lucide-solid";

export function FileSearchView() {
  const [pattern, setPattern] = createSignal("");
  const [searchRoot, setSearchRoot] = createSignal("");
  const [filterType, setFilterType] = createSignal<SearchQuery["file_type_filter"]>("all");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [results, setResults] = createSignal<SearchResultItem[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [drives, setDrives] = createSignal<SystemDrive[]>([]);
  const [copiedPath, setCopiedPath] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const list = await getSystemDrives();
      setDrives(list);
      if (list.length > 0) {
        setSearchRoot(list[0].path);
      }
    } catch (e) {
      console.warn("Failed to load drives:", e);
    }
  });

  const handleSearch = async () => {
    const p = pattern().trim();
    if (!p) return;

    setSearching(true);
    try {
      const res = await searchFiles({
        pattern: p,
        search_root: searchRoot().trim() || undefined,
        max_results: 300,
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

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch (e) {
      console.error("Copy path failed:", e);
    }
  };

  const handleReveal = async (path: string) => {
    try {
      await revealInExplorer(path);
    } catch (e) {
      console.warn("Reveal failed:", e);
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
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext))
      return <FileImage size={14} class="text-rose-500" />;
    if (["rs", "ts", "js", "py", "go", "cpp", "json", "toml"].includes(ext))
      return <FileCode size={14} class="text-blue-500" />;
    if (["md", "txt", "pdf", "docx", "xlsx"].includes(ext))
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
            High-speed local file indexing & instant wildcard search across drives
          </p>
        </div>
      </div>

      {/* Drive Selector + Search Input */}
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          {/* Drive Scope Selector */}
          <div class="w-44 flex items-center space-x-1.5 px-2.5 py-2 bg-card border border-input rounded-md text-xs">
            <HardDrive size={14} class="text-primary flex-shrink-0" />
            <select
              value={searchRoot()}
              onChange={(e) => {
                setSearchRoot(e.currentTarget.value);
                if (pattern().trim()) handleSearch();
              }}
              class="w-full bg-transparent text-foreground text-xs focus:outline-none cursor-pointer truncate"
            >
              <For each={drives()}>
                {(d) => <option value={d.path}>{d.name}</option>}
              </For>
            </select>
          </div>

          {/* Search Box */}
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
              placeholder="Search filename or extension across selected drive..."
              class="w-full pl-9 pr-3 py-2 bg-card border border-input rounded-md text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>

          <button
            onClick={handleSearch}
            class="px-4 py-2 bg-primary text-primary-foreground font-medium text-xs rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            {searching() ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Filters */}
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <div class="flex items-center space-x-2">
            <span class="font-medium text-foreground">Type:</span>
            {(
              [
                { id: "all", label: "All" },
                { id: "file", label: "Files" },
                { id: "dir", label: "Folders" },
                { id: "code", label: "Code" },
                { id: "image", label: "Images" },
                { id: "doc", label: "Documents" },
              ] as const
            ).map((f) => (
              <button
                onClick={() => {
                  setFilterType(f.id);
                  if (pattern().trim()) handleSearch();
                }}
                class={`px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                  filterType() === f.id
                    ? "bg-secondary text-foreground font-semibold"
                    : "hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

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
        </div>
      </div>

      {/* Results Table */}
      <div class="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
        <div class="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span class="w-1/2">Name & File Location</span>
          <span class="w-24 text-right">Size</span>
          <span class="w-36 text-right">Date Modified</span>
          <span class="w-20 text-right">Actions</span>
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-border/40">
          <Show
            when={results().length > 0}
            fallback={
              <div class="h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <Search size={32} class="opacity-40" />
                <p class="text-xs">
                  {searching()
                    ? "Scanning directories..."
                    : pattern()
                    ? "No files matched your search."
                    : "Type a filename or extension above to find files instantly."}
                </p>
              </div>
            }
          >
            <For each={results()}>
              {(item) => (
                <div class="px-3 py-1.5 hover:bg-secondary/40 flex items-center justify-between text-xs transition-colors group">
                  <div class="w-1/2 flex items-center space-x-2.5 min-w-0 pr-2">
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

                  <div class="w-20 flex items-center justify-end space-x-1">
                    <button
                      onClick={() => handleCopyPath(item.path)}
                      title="Copy Full Path"
                      class="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
                    >
                      {copiedPath() === item.path ? (
                        <Check size={13} class="text-green-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <button
                      onClick={() => handleReveal(item.path)}
                      title="Open in File Explorer"
                      class="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary"
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
