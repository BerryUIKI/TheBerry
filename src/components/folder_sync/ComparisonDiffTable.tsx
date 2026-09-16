import { createMemo, createSignal, For, Show } from "solid-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Equal,
  File,
  Folder,
  Minus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-solid";
import { ComparisonItem, ComparisonManifest, CompareResult, SyncAction } from "../../types/folder_sync";
import { useI18n } from "../../context/I18nContext";

interface ComparisonDiffTableProps {
  manifest: ComparisonManifest | null;
  onItemActionChange: (itemId: string, newAction: SyncAction) => void;
}

type FilterTab = "all" | "changed" | "conflicts" | "equal";

export function ComparisonDiffTable(props: ComparisonDiffTableProps) {
  const { language } = useI18n();
  const [filterTab, setFilterTab] = createSignal<FilterTab>("changed");
  const [searchKeyword, setSearchKeyword] = createSignal("");

  const filteredItems = createMemo(() => {
    if (!props.manifest) return [];
    const keyword = searchKeyword().toLowerCase().trim();

    return props.manifest.items.filter((item) => {
      // Filter tab
      if (filterTab() === "changed") {
        if (item.compare_result === "equal") return false;
      } else if (filterTab() === "conflicts") {
        if (item.compare_result !== "conflict") return false;
      } else if (filterTab() === "equal") {
        if (item.compare_result !== "equal") return false;
      }

      // Search keyword
      if (keyword) {
        return item.relative_path.toLowerCase().includes(keyword);
      }
      return true;
    });
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatTimestamp = (secs: number) => {
    if (!secs) return "-";
    const d = new Date(secs * 1000);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getResultBadge = (res: CompareResult) => {
    switch (res) {
      case "equal":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">{language() === "zh" ? "相同" : "Equal"}</span>;
      case "left_only":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">{language() === "zh" ? "仅左侧" : "Left Only"}</span>;
      case "right_only":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{language() === "zh" ? "仅右侧" : "Right Only"}</span>;
      case "left_newer":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">{language() === "zh" ? "左侧更新" : "Left Newer"}</span>;
      case "right_newer":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">{language() === "zh" ? "右侧更新" : "Right Newer"}</span>;
      case "different_content":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20">{language() === "zh" ? "内容不同" : "Different"}</span>;
      case "conflict":
        return <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">{language() === "zh" ? "冲突" : "Conflict"}</span>;
    }
  };

  return (
    <div class="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-0">
      {/* Header filter controls & search */}
      <div class="p-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterTab("changed")}
            class={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterTab() === "changed"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {language() === "zh" ? "仅差异项" : "Differences"} ({props.manifest ? props.manifest.summary.total_items - props.manifest.summary.equal_items : 0})
          </button>
          <button
            onClick={() => setFilterTab("all")}
            class={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterTab() === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {language() === "zh" ? "全部项" : "All Items"} ({props.manifest?.summary.total_items || 0})
          </button>
          <button
            onClick={() => setFilterTab("conflicts")}
            class={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterTab() === "conflicts"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {language() === "zh" ? "冲突项" : "Conflicts"} ({props.manifest?.summary.conflict_items || 0})
          </button>
          <button
            onClick={() => setFilterTab("equal")}
            class={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterTab() === "equal"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {language() === "zh" ? "完全一致" : "Identical"} ({props.manifest?.summary.equal_items || 0})
          </button>
        </div>

        <div class="w-full sm:w-64">
          <input
            type="text"
            placeholder={language() === "zh" ? "搜索比对项路径..." : "Search comparison path..."}
            value={searchKeyword()}
            onInput={(e) => setSearchKeyword(e.currentTarget.value)}
            class="w-full bg-background border border-input rounded-md px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Diff Table List */}
      <div class="flex-1 overflow-auto">
        <Show
          when={props.manifest && filteredItems().length > 0}
          fallback={
            <div class="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground p-6">
              <Show
                when={props.manifest}
                fallback={
                  <>
                    <Sparkles size={36} class="mb-3 text-muted-foreground/40" />
                    <p class="text-sm font-medium">
                      {language() === "zh"
                        ? "配置左侧与右侧文件夹，点击「开始比对」"
                        : "Configure left and right folders, then click 'Compare'"}
                    </p>
                    <p class="text-xs text-muted-foreground/70 mt-1">
                      {language() === "zh"
                        ? "FreeFileSync 核心比对引擎将为您快速找出所有文件变更与差异"
                        : "FreeFileSync core engine will quickly detect all file modifications and differences"}
                    </p>
                  </>
                }
              >
                <CheckCircle2 size={36} class="mb-3 text-emerald-500/50" />
                <p class="text-sm font-medium">
                  {language() === "zh" ? "当前筛选条件下暂无差异项" : "No differences under current filter"}
                </p>
                <p class="text-xs text-muted-foreground/70 mt-1">
                  {language() === "zh" ? "两端目录在此视图下完全同步" : "Both directories are completely synchronized in this view"}
                </p>
              </Show>
            </div>
          }
        >
          <table class="w-full border-collapse text-xs">
            <thead class="sticky top-0 bg-secondary/80 backdrop-blur-md border-b border-border select-none z-10">
              <tr>
                <th class="py-2 px-3 text-left font-medium text-muted-foreground w-5/12">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>{language() === "zh" ? "左侧项 (源)" : "Left Item (Source)"}</span>
                  </div>
                </th>
                <th class="py-2 px-2 text-center font-medium text-muted-foreground w-2/12">
                  {language() === "zh" ? "同步动作 (可手动覆盖)" : "Action (Manual Override)"}
                </th>
                <th class="py-2 px-3 text-left font-medium text-muted-foreground w-5/12">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>{language() === "zh" ? "右侧项 (目标)" : "Right Item (Target)"}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40 font-mono">
              <For each={filteredItems()}>
                {(item) => {
                  return (
                    <tr class="hover:bg-muted/40 transition-colors group">
                      {/* Left Column */}
                      <td class="py-2.5 px-3 align-top">
                        <Show
                          when={item.left}
                          fallback={
                            <span class="text-muted-foreground/40 italic text-[11px] font-sans">
                              {language() === "zh" ? "(不存在)" : "(Not present)"}
                            </span>
                          }
                        >
                          <div class="flex flex-col">
                            <div class="flex items-center gap-1.5 text-foreground font-medium truncate font-sans">
                              {item.is_dir ? (
                                <Folder size={14} class="text-blue-500 flex-shrink-0" />
                              ) : (
                                <File size={14} class="text-muted-foreground flex-shrink-0" />
                              )}
                              <span class="truncate" title={item.relative_path}>
                                {item.relative_path}
                              </span>
                            </div>
                            <div class="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                              <span>{formatBytes(item.left?.size_bytes || 0)}</span>
                              <span>{formatTimestamp(item.left?.modified_timestamp_secs || 0)}</span>
                            </div>
                          </div>
                        </Show>
                      </td>

                      {/* Middle Action / Diff Column */}
                      <td class="py-2.5 px-2 text-center align-middle">
                        <div class="flex flex-col items-center gap-1">
                          {getResultBadge(item.compare_result)}

                          {/* Action Selector */}
                          <div class="relative inline-block mt-0.5">
                            <select
                              value={item.action}
                              onChange={(e) =>
                                props.onItemActionChange(item.id, e.currentTarget.value as SyncAction)
                              }
                              class="text-[11px] font-sans bg-secondary/80 hover:bg-secondary border border-border/80 rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                            >
                              <option value="copy_left_to_right">
                                {language() === "zh" ? "复制到右侧 ➔" : "Copy to Right ➔"}
                              </option>
                              <option value="copy_right_to_left">
                                {language() === "zh" ? "⬅ 复制到左侧" : "⬅ Copy to Left"}
                              </option>
                              <option value="delete_right">
                                {language() === "zh" ? "删除右侧 ✖" : "Delete Right ✖"}
                              </option>
                              <option value="delete_left">
                                {language() === "zh" ? "✖ 删除左侧" : "✖ Delete Left"}
                              </option>
                              <option value="do_nothing">
                                {language() === "zh" ? "无动作 (跳过)" : "Do Nothing (Skip)"}
                              </option>
                              <option value="conflict">
                                {language() === "zh" ? "冲突 (未决定)" : "Conflict (Unresolved)"}
                              </option>
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* Right Column */}
                      <td class="py-2.5 px-3 align-top">
                        <Show
                          when={item.right}
                          fallback={
                            <span class="text-muted-foreground/40 italic text-[11px] font-sans">
                              {language() === "zh" ? "(不存在)" : "(Not present)"}
                            </span>
                          }
                        >
                          <div class="flex flex-col">
                            <div class="flex items-center gap-1.5 text-foreground font-medium truncate font-sans">
                              {item.is_dir ? (
                                <Folder size={14} class="text-emerald-500 flex-shrink-0" />
                              ) : (
                                <File size={14} class="text-muted-foreground flex-shrink-0" />
                              )}
                              <span class="truncate" title={item.relative_path}>
                                {item.relative_path}
                              </span>
                            </div>
                            <div class="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                              <span>{formatBytes(item.right?.size_bytes || 0)}</span>
                              <span>{formatTimestamp(item.right?.modified_timestamp_secs || 0)}</span>
                            </div>
                          </div>
                        </Show>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      {/* Footer telemetry summary */}
      <Show when={props.manifest}>
        <div class="p-3 border-t border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-4 flex-wrap">
            <span class="flex items-center gap-1 text-blue-500 font-medium">
              <span>{language() === "zh" ? "➔ 传输到右侧:" : "➔ To Right:"}</span>
              <span class="font-mono">{formatBytes(props.manifest!.summary.bytes_to_transfer_l2r)}</span>
            </span>
            <Show when={props.manifest!.summary.bytes_to_transfer_r2l > 0}>
              <span class="flex items-center gap-1 text-emerald-500 font-medium">
                <span>{language() === "zh" ? "⬅ 传输到左侧:" : "⬅ To Left:"}</span>
                <span class="font-mono">{formatBytes(props.manifest!.summary.bytes_to_transfer_r2l)}</span>
              </span>
            </Show>
            <Show when={props.manifest!.summary.items_to_delete_right > 0}>
              <span class="flex items-center gap-1 text-rose-500 font-medium">
                <span>{language() === "zh" ? "✖ 待删除右侧:" : "✖ Delete Right:"}</span>
                <span class="font-mono">
                  {props.manifest!.summary.items_to_delete_right} {language() === "zh" ? "个" : "items"}
                </span>
              </span>
            </Show>
            <Show when={props.manifest!.summary.conflict_items > 0}>
              <span class="flex items-center gap-1 text-amber-500 font-medium">
                <span>{language() === "zh" ? "⚠ 待决冲突:" : "⚠ Conflicts:"}</span>
                <span class="font-mono">
                  {props.manifest!.summary.conflict_items} {language() === "zh" ? "个" : "items"}
                </span>
              </span>
            </Show>
          </div>
          <div class="text-muted-foreground text-[11px]">
            {language() === "zh" ? (
              <>
                共比对 <span class="font-mono font-medium text-foreground">{props.manifest!.summary.total_items}</span> 项
              </>
            ) : (
              <>
                Compared <span class="font-mono font-medium text-foreground">{props.manifest!.summary.total_items}</span> items in total
              </>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
}
