import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { useApp, ViewType } from "../../context/AppContext";
import { useI18n, TranslationKey } from "../../context/I18nContext";
import {
  ClipboardList,
  Code2,
  Rocket,
  Image as ImageIcon,
  Search,
  Boxes,
  Settings,
  FolderDot,
  FolderSync,
  Tags,
  Fingerprint,
  QrCode,
  Braces,
  FileOutput,
  Archive,
  FileText,
  FileSpreadsheet,
  FileScan,
  Type,
  GripVertical,
  Sliders,
  ChevronDown,
  EyeOff,
  Edit2,
  RotateCcw,
  Check,
  X,
  Plus,
} from "lucide-solid";
import {
  loadNavigationConfig,
  reorderSidebarItems,
  toggleSidebarItemHidden,
  setSidebarItemCustomName,
} from "../../services/navigation";
import {
  KNOWN_NAV_ITEMS,
  NavItemConfig,
} from "../../types/navigation";
import { ContextMenu, ContextMenuItem } from "../common/ContextMenu";
import { useToast } from "../../context/ToastContext";

const ICON_MAP: Record<string, any> = {
  ClipboardList,
  Code2,
  Rocket,
  ImageIcon,
  Search,
  FolderSync,
  Boxes,
  Tags,
  Fingerprint,
  QrCode,
  Braces,
  FileOutput,
  Archive,
  FileText,
  FileSpreadsheet,
  FileScan,
  Type,
};

export function Sidebar() {
  const { activeView, setActiveView } = useApp();
  const { t, language } = useI18n();
  const { success } = useToast();

  const [sidebarItems, setSidebarItems] = createSignal<NavItemConfig[]>([]);

  // Drag and drop states (Pointer-based & Long-press)
  let sidebarContainerRef: HTMLDivElement | undefined;
  let pressTimer: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragStartIndex: number | null = null;
  const [isPointerDragging, setIsPointerDragging] = createSignal(false);
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    isOpen: boolean;
    item: NavItemConfig | null;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    item: null,
  });

  // Rename modal state
  const [renamingItem, setRenamingItem] = createSignal<NavItemConfig | null>(null);
  const [renameInput, setRenameInput] = createSignal("");

  const reloadNav = () => {
    const config = loadNavigationConfig();
    setSidebarItems(config.sidebarItems);
  };

  const handlePointerDown = (e: PointerEvent, index: number) => {
    // Only primary button (left click or touch)
    if (e.button !== 0) return;

    startX = e.clientX;
    startY = e.clientY;
    dragStartIndex = index;

    if (pressTimer) clearTimeout(pressTimer);
    // 150ms long-press threshold
    pressTimer = window.setTimeout(() => {
      setIsPointerDragging(true);
      setDraggedIndex(index);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }, 150);
  };

  const handleWindowPointerMove = (e: PointerEvent) => {
    if (dragStartIndex === null) return;

    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);

    // If moved > 4px, activate drag immediately without waiting for timer
    if (!isPointerDragging() && (dx > 4 || dy > 4)) {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      setIsPointerDragging(true);
      setDraggedIndex(dragStartIndex);
    }

    if (isPointerDragging() && sidebarContainerRef) {
      const itemEls = sidebarContainerRef.querySelectorAll<HTMLElement>("[data-sidebar-item-index]");
      let foundIndex: number | null = null;

      itemEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const raw = el.getAttribute("data-sidebar-item-index");
          if (raw !== null) {
            foundIndex = parseInt(raw, 10);
          }
        }
      });

      setDragOverIndex(foundIndex);
    }
  };

  const handleWindowPointerUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    if (dragStartIndex !== null) {
      if (isPointerDragging()) {
        const from = draggedIndex();
        const to = dragOverIndex();
        if (from !== null && to !== null && from !== to) {
          const updated = reorderSidebarItems(from, to);
          setSidebarItems(updated);
          success(
            language() === "zh" ? "排序已更新" : "Order Updated",
            language() === "zh" ? "侧边栏导航已重新排列" : "Sidebar navigation reordered"
          );
        }
      } else {
        // Quick tap or click
        const items = visibleItems();
        if (dragStartIndex >= 0 && dragStartIndex < items.length) {
          handleItemClick(items[dragStartIndex]);
        }
      }
    }

    setIsPointerDragging(false);
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragStartIndex = null;
  };

  onMount(() => {
    reloadNav();
    const handleNavChange = () => reloadNav();
    window.addEventListener("navigation-state-changed", handleNavChange);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    onCleanup(() => {
      window.removeEventListener("navigation-state-changed", handleNavChange);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      if (pressTimer) clearTimeout(pressTimer);
    });
  });

  const visibleItems = () => sidebarItems().filter((item) => !item.hidden && item.id !== "toolbox");

  const getItemMeta = (id: string) => KNOWN_NAV_ITEMS[id] || {
    id,
    defaultKey: "nav.toolbox",
    name: { zh: id, en: id },
    iconName: "Boxes",
    isView: true,
  };

  const getItemLabel = (item: NavItemConfig) => {
    if (item.customName?.trim()) {
      return item.customName;
    }
    const meta = getItemMeta(item.id);
    if (meta.defaultKey && meta.isView) {
      try {
        const translated = t(meta.defaultKey as TranslationKey);
        if (translated && translated !== meta.defaultKey) return translated;
      } catch (e) {
        // fallback
      }
    }
    return language() === "zh" ? meta.name.zh : meta.name.en;
  };

  const getItemIcon = (id: string) => {
    const meta = getItemMeta(id);
    return ICON_MAP[meta.iconName] || Boxes;
  };

  const handleItemClick = (item: NavItemConfig) => {
    const meta = getItemMeta(item.id);
    if (meta.isView) {
      setActiveView(item.id as ViewType);
    } else {
      setActiveView("toolbox");
      window.dispatchEvent(new CustomEvent("open-toolbox-tool", { detail: item.id }));
    }
  };

  // Context Menu trigger
  const handleContextMenu = (e: MouseEvent, item: NavItemConfig) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      item,
    });
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    const target = contextMenu().item;
    if (!target) return [];

    const label = getItemLabel(target);

    return [
      {
        id: "rename",
        label: language() === "zh" ? `重命名 "${label}"` : `Rename "${label}"`,
        icon: Edit2,
        onClick: () => {
          setRenamingItem(target);
          setRenameInput(target.customName || label);
        },
      },
      {
        id: "hide",
        label: language() === "zh" ? "从侧边栏隐藏" : "Hide from Sidebar",
        icon: EyeOff,
        onClick: () => {
          toggleSidebarItemHidden(target.id, true);
          success(
            language() === "zh" ? "已从侧边栏隐藏" : "Hidden from Sidebar",
            language() === "zh"
              ? `"${label}" 已隐藏，可在“侧边栏导航与布局”中随时恢复`
              : `"${label}" hidden from sidebar, restore anytime in Navigation & Layout`
          );
        },
      },
      ...(target.customName
        ? [
            {
              id: "reset_name",
              label: language() === "zh" ? "恢复默认名称" : "Reset Default Name",
              icon: RotateCcw,
              onClick: () => {
                setSidebarItemCustomName(target.id, undefined);
              },
            },
          ]
        : []),
      {
        id: "divider",
        label: "",
        divider: true,
      },
      {
        id: "manage_all",
        label: language() === "zh" ? "管理侧边栏导航..." : "Manage Sidebar Navigation...",
        icon: Sliders,
        onClick: () => {
          window.dispatchEvent(new CustomEvent("open-navigation-manager"));
        },
      },
    ];
  };

  const handleSaveRename = () => {
    const target = renamingItem();
    if (!target) return;
    setSidebarItemCustomName(target.id, renameInput());
    setRenamingItem(null);
    success(
      language() === "zh" ? "名称已更新" : "Name Updated",
      language() === "zh" ? "侧边栏显示名称已保存" : "Sidebar label saved"
    );
  };

  return (
    <aside
      onContextMenu={(e) => {
        // Right-clicking empty sidebar area offers "Manage Navigation"
        if (e.target === e.currentTarget) {
          e.preventDefault();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            isOpen: true,
            item: null,
          });
        }
      }}
      class="w-56 h-full bg-sidebar border-r border-sidebar-border flex flex-col justify-between select-none flex-shrink-0"
    >
      <div class="flex-1 flex flex-col p-2 space-y-1 overflow-y-auto">
        {/* Header with Title & Quick Manage Button */}
        <div class="px-3 py-2 flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Utilities Suite
          </span>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-navigation-manager"))}
            class="text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60 p-1 rounded transition-colors"
            title={language() === "zh" ? "侧边栏导航与布局" : "Sidebar Navigation & Layout"}
          >
            <Sliders size={12} />
          </button>
        </div>

        {/* Visible Items with Pointer & Long-Press Drag & Drop Reordering */}
        <div ref={sidebarContainerRef} class="space-y-0.5">
          <For each={visibleItems()}>
            {(item, index) => {
              const isActive = () => activeView() === item.id;
              const Icon = getItemIcon(item.id);
              const isDragged = () => draggedIndex() === index();
              const isOver = () => dragOverIndex() === index();

              return (
                <div
                  data-sidebar-item-index={index()}
                  role="button"
                  tabindex="0"
                  onPointerDown={(e) => handlePointerDown(e, index())}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  onDragStart={(e) => e.preventDefault()}
                  class={`group relative flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium cursor-pointer select-none transition-all duration-150 touch-none ${
                    isActive()
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
                  } ${
                    isDragged()
                      ? "drag-item-active z-30"
                      : isOver()
                      ? "ring-2 ring-primary/60 bg-primary/10 border-primary"
                      : "hover:translate-x-0.5"
                  }`}
                >
                  {/* Dynamic Drop Indicator Line */}
                  <Show when={isOver() && !isDragged()}>
                    <div
                      class={`drop-indicator-line ${
                        draggedIndex() !== null && draggedIndex()! < index()
                          ? "-bottom-[1.5px]"
                          : "-top-[1.5px]"
                      }`}
                    >
                      <span class="drop-indicator-pill-left" />
                      <span class="drop-indicator-pill-right" />
                    </div>
                  </Show>

                  <div class="flex items-center space-x-2.5 min-w-0 flex-1 pointer-events-none">
                    <Icon
                      size={15}
                      class={`flex-shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                        isActive() ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    />
                    <span class="truncate text-left">{getItemLabel(item)}</span>
                  </div>

                  {/* Tactile Drag Handle */}
                  <span
                    class="drag-grip-handle flex items-center justify-center p-0.5 rounded text-muted-foreground/50 group-hover:text-foreground group-hover:opacity-100 opacity-40 hover:!opacity-100 transition-all duration-150 flex-shrink-0 cursor-grab active:cursor-grabbing"
                    title={language() === "zh" ? "长按或拖拽排序 / 右键菜单" : "Hold or drag to reorder / Right click"}
                  >
                    <GripVertical size={13} />
                  </span>
                </div>
              );
            }}
          </For>
        </div>

      </div>

      {/* Bottom Footer: Permanent Toolbox Button */}
      <div class="p-2 border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={() => setActiveView("toolbox")}
          class={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
            activeView() === "toolbox"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground hover:bg-secondary hover:text-foreground bg-secondary/30"
          }`}
          title={t("nav.toolbox")}
        >
          <Boxes
            size={16}
            class={`flex-shrink-0 ${
              activeView() === "toolbox" ? "text-primary-foreground" : "text-primary"
            }`}
          />
          <span class="truncate">{t("nav.toolbox")}</span>
        </button>
      </div>

      {/* Floating Context Menu */}
      <ContextMenu
        x={contextMenu().x}
        y={contextMenu().y}
        isOpen={contextMenu().isOpen}
        items={
          contextMenu().item
            ? getContextMenuItems()
            : [
                {
                  id: "manage_all",
                  label: language() === "zh" ? "管理侧边栏导航..." : "Manage Sidebar Navigation...",
                  icon: Sliders,
                  onClick: () => {
                    window.dispatchEvent(new CustomEvent("open-navigation-manager"));
                  },
                },
              ]
        }
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Mini Rename Modal */}
      <Show when={renamingItem()}>
        <div
          class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
          onClick={() => setRenamingItem(null)}
        >
          <div
            class="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-4 space-y-3 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-foreground">
                {language() === "zh" ? "编辑显示别名" : "Edit Display Label"}
              </h4>
              <button
                onClick={() => setRenamingItem(null)}
                class="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>

            <input
              type="text"
              value={renameInput()}
              onInput={(e) => setRenameInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") setRenamingItem(null);
              }}
              placeholder={language() === "zh" ? "输入自定义名称..." : "Enter custom name..."}
              class="w-full h-8 px-3 text-xs bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />

            <div class="flex items-center justify-end space-x-2 pt-1">
              <button
                onClick={() => setRenamingItem(null)}
                class="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveRename}
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </aside>
  );
}
