import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import {
  X,
  GripVertical,
  Eye,
  EyeOff,
  Edit2,
  RotateCcw,
  Sliders,
  Check,
  Search,
  Pin,
  PinOff,
} from "lucide-solid";
import {
  loadNavigationConfig,
  saveNavigationConfig,
  resetNavigationToDefault,
  setSidebarItemCustomName,
  toggleSidebarItemHidden,
  pinToSidebar,
} from "../../services/navigation";
import {
  KNOWN_NAV_ITEMS,
  NavItemConfig,
  DEFAULT_SIDEBAR_ORDER,
} from "../../types/navigation";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";

export function NavigationManagerModal(props: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const { success } = useToast();

  const [items, setItems] = createSignal<NavItemConfig[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editInputVal, setEditInputVal] = createSignal("");
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  const reload = () => {
    const config = loadNavigationConfig();
    setItems(config.sidebarItems);
  };

  onMount(() => {
    reload();
    const handleNavChange = () => reload();
    window.addEventListener("navigation-state-changed", handleNavChange);
    onCleanup(() => {
      window.removeEventListener("navigation-state-changed", handleNavChange);
    });
  });

  const getItemLabel = (item: NavItemConfig) => {
    if (item.customName?.trim()) {
      return item.customName;
    }
    const meta = KNOWN_NAV_ITEMS[item.id];
    if (!meta) return item.id;
    return language() === "zh" ? meta.name.zh : meta.name.en;
  };

  const handleToggleHide = (id: string) => {
    const updated = toggleSidebarItemHidden(id);
    setItems(updated);
  };

  const handleStartEdit = (item: NavItemConfig) => {
    setEditingId(item.id);
    setEditInputVal(item.customName || getItemLabel(item));
  };

  const handleSaveEdit = (id: string) => {
    const next = setSidebarItemCustomName(id, editInputVal());
    setItems(next);
    setEditingId(null);
    success(
      language() === "zh" ? "别名已保存" : "Alias Saved",
      language() === "zh" ? "侧边栏显示名称已更新" : "Navigation display label updated"
    );
  };

  const handleResetName = (id: string) => {
    const next = setSidebarItemCustomName(id, undefined);
    setItems(next);
    setEditingId(null);
  };

  const handleResetDefaults = () => {
    const def = resetNavigationToDefault();
    setItems(def.sidebarItems);
    success(
      language() === "zh" ? "已恢复默认布局" : "Reset Complete",
      language() === "zh" ? "侧边栏与工具箱已恢复至出厂顺序" : "Sidebar and toolbox layout restored to defaults"
    );
  };

  // Drag and drop reordering inside modal
  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `${index}`);
    }
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setDragOverIndex(index);
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    const startIndex = draggedIndex();
    if (startIndex === null || startIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const next = [...items()];
    const [moved] = next.splice(startIndex, 1);
    next.splice(dropIndex, 0, moved);

    const reordered = next.map((it, idx) => ({ ...it, order: idx }));
    setItems(reordered);
    saveNavigationConfig({
      ...loadNavigationConfig(),
      sidebarItems: reordered,
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const filteredItems = () => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return items();
    return items().filter((it) => {
      const label = getItemLabel(it).toLowerCase();
      const rawId = it.id.toLowerCase();
      return label.includes(q) || rawId.includes(q);
    });
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md animate-in fade-in duration-150 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div class="flex items-center space-x-2.5">
              <div class="p-2 rounded-xl bg-primary/10 text-primary">
                <Sliders size={18} />
              </div>
              <div>
                <h3 class="text-sm font-bold text-foreground">
                  {language() === "zh" ? "侧边栏导航与收纳定制" : "Sidebar Navigation & Layout"}
                </h3>
                <p class="text-xs text-muted-foreground">
                  {language() === "zh"
                    ? "拖动排序、自定义别名、隐藏或显示侧边栏功能"
                    : "Drag to reorder, customize aliases, and toggle visibility"}
                </p>
              </div>
            </div>

            <button
              onClick={props.onClose}
              class="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search bar & Reset Action */}
          <div class="px-5 py-3 border-b border-border flex items-center justify-between gap-3 bg-background/50">
            <div class="relative flex-1">
              <Search size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder={language() === "zh" ? "过滤导航项..." : "Filter navigation items..."}
                class="w-full h-8 pl-8 pr-3 text-xs bg-card border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              onClick={handleResetDefaults}
              class="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center space-x-1.5 transition-colors"
              title={language() === "zh" ? "恢复默认布局" : "Restore defaults"}
            >
              <RotateCcw size={13} />
              <span>{language() === "zh" ? "恢复默认" : "Reset Defaults"}</span>
            </button>
          </div>

          {/* Item List */}
          <div class="p-4 overflow-y-auto space-y-2 flex-1">
            <For each={filteredItems()}>
              {(item, index) => {
                const meta = KNOWN_NAV_ITEMS[item.id];
                const isEditing = () => editingId() === item.id;
                const isDragged = () => draggedIndex() === index();
                const isOver = () => dragOverIndex() === index();

                return (
                  <div
                    draggable={!isEditing()}
                    onDragStart={(e) => handleDragStart(e, index())}
                    onDragOver={(e) => handleDragOver(e, index())}
                    onDrop={(e) => handleDrop(e, index())}
                    class={`flex items-center justify-between p-2.5 rounded-xl border transition-all select-none ${
                      item.hidden
                        ? "bg-muted/20 border-border/50 opacity-60 hover:opacity-90"
                        : "bg-card border-border hover:border-primary/40 shadow-sm"
                    } ${isDragged() ? "opacity-30 border-dashed border-primary" : ""} ${
                      isOver() ? "ring-2 ring-primary/40 border-primary" : ""
                    }`}
                  >
                    {/* Left: Drag Handle + Icon + Label */}
                    <div class="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                      <span
                        class="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-0.5"
                        title={language() === "zh" ? "按住拖动排序" : "Drag to reorder"}
                      >
                        <GripVertical size={15} />
                      </span>

                      <Show
                        when={isEditing()}
                        fallback={
                          <div class="flex items-center space-x-2 min-w-0">
                            <span class="text-xs font-semibold text-foreground truncate">
                              {getItemLabel(item)}
                            </span>
                            <Show when={item.customName}>
                              <span class="text-[9px] px-1 py-0.2 rounded bg-primary/10 text-primary font-mono">
                                {language() === "zh" ? "自定义别名" : "Custom"}
                              </span>
                            </Show>
                            <Show when={item.hidden}>
                              <span class="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                {language() === "zh" ? "已收纳隐藏" : "Hidden"}
                              </span>
                            </Show>
                          </div>
                        }
                      >
                        <div class="flex items-center space-x-1.5 flex-1">
                          <input
                            type="text"
                            value={editInputVal()}
                            onInput={(e) => setEditInputVal(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            class="h-7 px-2 text-xs bg-background border border-primary rounded text-foreground focus:outline-none flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            class="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                            title={language() === "zh" ? "保存别名" : "Save"}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => handleResetName(item.id)}
                            class="px-2 py-1 rounded bg-secondary text-[11px] text-muted-foreground hover:text-foreground"
                            title={language() === "zh" ? "恢复原名" : "Reset name"}
                          >
                            {language() === "zh" ? "原名" : "Reset"}
                          </button>
                        </div>
                      </Show>
                    </div>

                    {/* Right: Actions (Edit Name, Toggle Visibility) */}
                    <div class="flex items-center space-x-1 flex-shrink-0">
                      <Show when={!isEditing()}>
                        <button
                          onClick={() => handleStartEdit(item)}
                          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title={language() === "zh" ? "编辑别名" : "Edit display name"}
                        >
                          <Edit2 size={13} />
                        </button>
                      </Show>

                      <button
                        onClick={() => handleToggleHide(item.id)}
                        class={`p-1.5 rounded-lg transition-colors ${
                          item.hidden
                            ? "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            : "text-foreground hover:bg-secondary"
                        }`}
                        title={
                          item.hidden
                            ? language() === "zh"
                              ? "从收纳箱恢复显示到侧边栏"
                              : "Show on sidebar"
                            : language() === "zh"
                            ? "从侧边栏隐藏并收纳"
                            : "Hide from sidebar"
                        }
                      >
                        {item.hidden ? <EyeOff size={14} /> : <Eye size={14} class="text-primary" />}
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Footer tip */}
          <div class="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {language() === "zh"
                ? "提示：被隐藏的工具将统一收纳在侧边栏底部的「已收纳」或工具箱中。"
                : "Tip: Hidden utilities are safely stored in Toolbox and the bottom 'Stored' drawer."}
            </span>
            <button
              onClick={props.onClose}
              class="px-3.5 py-1.5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
            >
              {language() === "zh" ? "完成" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
