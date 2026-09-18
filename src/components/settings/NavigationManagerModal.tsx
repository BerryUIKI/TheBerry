import { createSignal, onMount, onCleanup, createEffect, For, Show } from "solid-js";
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
  ChevronUp,
  ChevronDown,
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
  // Pointer-based item drag & drop state
  let listContainerRef: HTMLDivElement | undefined;
  let dragCandidateId: string | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  const [isPointerDragging, setIsPointerDragging] = createSignal(false);
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dragOverId, setDragOverId] = createSignal<string | null>(null);
  const [dropPosition, setDropPosition] = createSignal<"before" | "after" | null>(null);

  // Draggable Modal Dialog state
  const [modalPos, setModalPos] = createSignal({ x: 0, y: 0 });
  let isDraggingModal = false;
  let modalStartPos = { x: 0, y: 0 };
  let modalPointerStart = { x: 0, y: 0 };

  createEffect(() => {
    if (props.isOpen) {
      setModalPos({ x: 0, y: 0 });
    }
  });

  const reload = () => {
    const config = loadNavigationConfig();
    setItems(config.sidebarItems);
  };

  // Item pointer event listeners on window
  const handleGlobalPointerMove = (e: PointerEvent) => {
    if (!dragCandidateId) return;

    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);

    if (!isPointerDragging() && (dx > 3 || dy > 3)) {
      setIsPointerDragging(true);
      setDraggedId(dragCandidateId);
    }

    if (isPointerDragging() && listContainerRef) {
      const itemEls = listContainerRef.querySelectorAll<HTMLElement>("[data-nav-id]");
      let foundId: string | null = null;
      let pos: "before" | "after" = "before";

      itemEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const id = el.getAttribute("data-nav-id");
          if (id) {
            foundId = id;
            const midY = rect.top + rect.height / 2;
            pos = e.clientY < midY ? "before" : "after";
          }
        }
      });

      setDragOverId(foundId);
      setDropPosition(pos);
    }
  };

  const handleGlobalPointerUp = () => {
    if (isPointerDragging() && draggedId() && dragOverId() && draggedId() !== dragOverId()) {
      const fromId = draggedId()!;
      const toId = dragOverId()!;
      const pos = dropPosition();

      const currentItems = [...items()];
      const fromIndex = currentItems.findIndex((it) => it.id === fromId);
      if (fromIndex !== -1) {
        const [movedItem] = currentItems.splice(fromIndex, 1);
        let targetIndex = currentItems.findIndex((it) => it.id === toId);
        if (targetIndex !== -1) {
          if (pos === "after") {
            targetIndex += 1;
          }
          currentItems.splice(targetIndex, 0, movedItem);
          const reordered = currentItems.map((it, idx) => ({ ...it, order: idx }));
          setItems(reordered);
          saveNavigationConfig({
            ...loadNavigationConfig(),
            sidebarItems: reordered,
          });
          success(
            language() === "zh" ? "排序已更新" : "Order Updated",
            language() === "zh" ? "侧边栏导航已重新排列" : "Sidebar navigation reordered"
          );
        }
      }
    }

    dragCandidateId = null;
    setIsPointerDragging(false);
    setDraggedId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  onMount(() => {
    reload();
    const handleNavChange = () => reload();
    window.addEventListener("navigation-state-changed", handleNavChange);
    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);

    onCleanup(() => {
      window.removeEventListener("navigation-state-changed", handleNavChange);
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
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

  const handleMoveUp = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const current = [...items()];
    const idx = current.findIndex((it) => it.id === id);
    if (idx > 0) {
      const temp = current[idx];
      current[idx] = current[idx - 1];
      current[idx - 1] = temp;
      const reordered = current.map((it, i) => ({ ...it, order: i }));
      setItems(reordered);
      saveNavigationConfig({
        ...loadNavigationConfig(),
        sidebarItems: reordered,
      });
      success(
        language() === "zh" ? "排序已更新" : "Order Updated",
        language() === "zh" ? "导航项已上移" : "Item moved up"
      );
    }
  };

  const handleMoveDown = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const current = [...items()];
    const idx = current.findIndex((it) => it.id === id);
    if (idx >= 0 && idx < current.length - 1) {
      const temp = current[idx];
      current[idx] = current[idx + 1];
      current[idx + 1] = temp;
      const reordered = current.map((it, i) => ({ ...it, order: i }));
      setItems(reordered);
      saveNavigationConfig({
        ...loadNavigationConfig(),
        sidebarItems: reordered,
      });
      success(
        language() === "zh" ? "排序已更新" : "Order Updated",
        language() === "zh" ? "导航项已下移" : "Item moved down"
      );
    }
  };

  const handleItemPointerDown = (e: PointerEvent, itemId: string, isHandle: boolean) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!isHandle && (target.closest("button") || target.closest("input"))) return;

    dragCandidateId = itemId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  };

  // Dragging the Modal Window by its header
  const handleModalHeaderPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    isDraggingModal = true;
    modalStartPos = { ...modalPos() };
    modalPointerStart = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleModalHeaderPointerMove = (e: PointerEvent) => {
    if (!isDraggingModal) return;
    const dx = e.clientX - modalPointerStart.x;
    const dy = e.clientY - modalPointerStart.y;
    setModalPos({
      x: modalStartPos.x + dx,
      y: modalStartPos.y + dy,
    });
  };

  const handleModalHeaderPointerUp = (e: PointerEvent) => {
    if (!isDraggingModal) return;
    isDraggingModal = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const filteredItems = () => {
    const q = searchQuery().trim().toLowerCase();
    const base = items().filter((it) => it.id !== "toolbox");
    if (!q) return base;
    return base.filter((it) => {
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
          if (e.target === e.currentTarget && !isPointerDragging() && !isDraggingModal) {
            props.onClose();
          }
        }}
      >
        <div
          style={{
            transform: `translate3d(${modalPos().x}px, ${modalPos().y}px, 0)`,
          }}
          class="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 select-none"
        >
          {/* Modal Header (Draggable) */}
          <div
            onPointerDown={handleModalHeaderPointerDown}
            onPointerMove={handleModalHeaderPointerMove}
            onPointerUp={handleModalHeaderPointerUp}
            onPointerCancel={handleModalHeaderPointerUp}
            class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30 cursor-grab active:cursor-grabbing select-none"
            title={language() === "zh" ? "按住可拖动窗口" : "Hold to drag dialog"}
          >
            <div class="flex items-center space-x-2.5 pointer-events-none">
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
              class="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
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
              class="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center space-x-1.5 transition-colors cursor-pointer"
              title={language() === "zh" ? "恢复默认布局" : "Restore defaults"}
            >
              <RotateCcw size={13} />
              <span>{language() === "zh" ? "恢复默认" : "Reset Defaults"}</span>
            </button>
          </div>

          {/* Item List with Pointer Drag Reordering */}
          <div ref={listContainerRef} class="p-4 overflow-y-auto space-y-2 flex-1">
            <For each={filteredItems()}>
              {(item, index) => {
                const isEditing = () => editingId() === item.id;
                const isDragged = () => isPointerDragging() && draggedId() === item.id;
                const isOver = () => isPointerDragging() && dragOverId() === item.id;

                return (
                  <div
                    data-nav-id={item.id}
                    onPointerDown={(e) => handleItemPointerDown(e, item.id, false)}
                    class={`group relative flex items-center justify-between p-2.5 rounded-xl border select-none transition-all duration-150 touch-none ${
                      item.hidden
                        ? "bg-muted/20 border-border/50 opacity-60 hover:opacity-90"
                        : "bg-card border-border hover:border-primary/40 shadow-sm"
                    } ${
                      isDragged()
                        ? "drag-item-active z-30"
                        : isOver()
                        ? "bg-primary/5 border-primary/60 ring-2 ring-primary/30"
                        : "hover:translate-x-0.5"
                    }`}
                  >
                    {/* Dynamic Drop Indicator Line */}
                    <Show when={isOver() && !isDragged()}>
                      <div
                        class={`drop-indicator-line ${
                          dropPosition() === "after" ? "-bottom-[1.5px]" : "-top-[1.5px]"
                        }`}
                      >
                        <span class="drop-indicator-pill-left" />
                        <span class="drop-indicator-pill-right" />
                      </div>
                    </Show>

                    {/* Left: Drag Handle + Label */}
                    <div class="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                      <span
                        class="drag-grip-handle text-muted-foreground/60 hover:text-foreground p-1 rounded hover:bg-muted/40 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleItemPointerDown(e, item.id, true);
                        }}
                        title={language() === "zh" ? "按住拖动排序" : "Drag to reorder"}
                      >
                        <GripVertical size={15} />
                      </span>

                      <Show
                        when={isEditing()}
                        fallback={
                          <div class="flex items-center space-x-2 min-w-0 pointer-events-none">
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
                            class="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                            title={language() === "zh" ? "保存别名" : "Save"}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => handleResetName(item.id)}
                            class="px-2 py-1 rounded bg-secondary text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                            title={language() === "zh" ? "恢复原名" : "Reset name"}
                          >
                            {language() === "zh" ? "原名" : "Reset"}
                          </button>
                        </div>
                      </Show>
                    </div>

                    {/* Right: Quick Up/Down buttons + Edit Name + Toggle Visibility */}
                    <div class="flex items-center space-x-0.5 flex-shrink-0">
                      <Show when={!isEditing()}>
                        {/* Quick Up/Down Reorder Buttons */}
                        <button
                          type="button"
                          onClick={(e) => handleMoveUp(e, item.id)}
                          disabled={index() === 0}
                          class="p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title={language() === "zh" ? "上移一位" : "Move up"}
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleMoveDown(e, item.id)}
                          disabled={index() === filteredItems().length - 1}
                          class="p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title={language() === "zh" ? "下移一位" : "Move down"}
                        >
                          <ChevronDown size={13} />
                        </button>

                        <div class="h-3 w-[1px] bg-border mx-0.5" />

                        {/* Edit alias */}
                        <button
                          onClick={() => handleStartEdit(item)}
                          class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                          title={language() === "zh" ? "编辑别名" : "Edit display name"}
                        >
                          <Edit2 size={13} />
                        </button>
                      </Show>

                      {/* Toggle Hide / Show */}
                      <button
                        onClick={() => handleToggleHide(item.id)}
                        class={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          item.hidden
                            ? "text-muted-foreground hover:text-primary hover:bg-primary/10"
                            : "text-foreground hover:bg-secondary"
                        }`}
                        title={
                          item.hidden
                            ? language() === "zh"
                              ? "恢复显示到侧边栏"
                              : "Show on sidebar"
                            : language() === "zh"
                            ? "从侧边栏隐藏"
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
              class="px-3.5 py-1.5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 text-xs cursor-pointer"
            >
              {language() === "zh" ? "完成" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
