import { createSignal, For } from "solid-js";
import { Plus, Trash2, X, SlidersHorizontal, RotateCcw } from "lucide-solid";
import { PathFilter } from "../../types/folder_sync";

interface FilterSettingsModalProps {
  isOpen: boolean;
  filter: PathFilter;
  onSave: (filter: PathFilter) => void;
  onClose: () => void;
}

export function FilterSettingsModal(props: FilterSettingsModalProps) {
  const [includeText, setIncludeText] = createSignal(props.filter.include_patterns.join("\n"));
  const [excludeText, setExcludeText] = createSignal(props.filter.exclude_patterns.join("\n"));
  const [minSizeMB, setMinSizeMB] = createSignal<string>(
    props.filter.min_size_bytes ? (props.filter.min_size_bytes / (1024 * 1024)).toString() : ""
  );
  const [maxSizeMB, setMaxSizeMB] = createSignal<string>(
    props.filter.max_size_bytes ? (props.filter.max_size_bytes / (1024 * 1024)).toString() : ""
  );

  const presets = [
    { label: ".git/*", desc: "Git版本库" },
    { label: "node_modules/*", desc: "Node依赖" },
    { label: "*.tmp", desc: "临时文件" },
    { label: "~$*", desc: "Office临时文件" },
    { label: "Thumbs.db", desc: "缩略图缓存" },
    { label: ".DS_Store", desc: "macOS索引" },
  ];

  const handleAddPreset = (pattern: string) => {
    const current = excludeText()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(pattern)) {
      setExcludeText([...current, pattern].join("\n"));
    }
  };

  const handleReset = () => {
    setIncludeText("*");
    setExcludeText(
      ["*.tmp", "~$*", ".git/*", "node_modules/*", ".DS_Store", "Thumbs.db", "desktop.ini"].join("\n")
    );
    setMinSizeMB("");
    setMaxSizeMB("");
  };

  const handleSave = () => {
    const includes = includeText()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const excludes = excludeText()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const minBytes = minSizeMB() ? parseFloat(minSizeMB()) * 1024 * 1024 : null;
    const maxBytes = maxSizeMB() ? parseFloat(maxSizeMB()) * 1024 * 1024 : null;

    props.onSave({
      include_patterns: includes.length > 0 ? includes : ["*"],
      exclude_patterns: excludes,
      min_size_bytes: minBytes,
      max_size_bytes: maxBytes,
    });
    props.onClose();
  };

  if (!props.isOpen) return null;

  return (
    <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <SlidersHorizontal size={18} class="text-primary" />
            <h3 class="text-sm font-semibold text-foreground">过滤器规则配置</h3>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Exclude Rules */}
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold text-foreground">
              排除规则 (Exclude Patterns, 每行一条通配符)
            </label>
            <span class="text-[10px] text-muted-foreground">支持 * 与 ?</span>
          </div>
          <textarea
            rows={4}
            value={excludeText()}
            onInput={(e) => setExcludeText(e.currentTarget.value)}
            class="w-full bg-background border border-input rounded-lg p-2.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="例如: *.tmp&#10;node_modules/*&#10;.git/*"
          />

          {/* Quick Presets */}
          <div class="flex items-center gap-1.5 flex-wrap mt-2">
            <span class="text-[10px] text-muted-foreground mr-1">快捷添加:</span>
            <For each={presets}>
              {(p) => (
                <button
                  type="button"
                  onClick={() => handleAddPreset(p.label)}
                  class="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-primary/20 hover:text-primary text-secondary-foreground transition-colors border border-border/50"
                  title={p.desc}
                >
                  +{p.label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Include Rules */}
        <div>
          <label class="text-xs font-semibold text-foreground block mb-1.5">
            包含规则 (Include Patterns, 默认 * 包含全部)
          </label>
          <textarea
            rows={2}
            value={includeText()}
            onInput={(e) => setIncludeText(e.currentTarget.value)}
            class="w-full bg-background border border-input rounded-lg p-2.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="*"
          />
        </div>

        {/* File Size Limits */}
        <div class="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label class="text-xs font-medium text-muted-foreground block mb-1">
              最小体积限制 (MB)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="无限制"
              value={minSizeMB()}
              onInput={(e) => setMinSizeMB(e.currentTarget.value)}
              class="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-muted-foreground block mb-1">
              最大体积限制 (MB)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="无限制"
              value={maxSizeMB()}
              onInput={(e) => setMaxSizeMB(e.currentTarget.value)}
              class="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Buttons */}
        <div class="flex items-center justify-between border-t border-border pt-3 mt-1">
          <button
            type="button"
            onClick={handleReset}
            class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
          >
            <RotateCcw size={12} />
            <span>恢复默认</span>
          </button>
          <div class="flex items-center gap-2">
            <button
              onClick={props.onClose}
              class="px-4 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              class="px-5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-colors"
            >
              应用过滤器
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
