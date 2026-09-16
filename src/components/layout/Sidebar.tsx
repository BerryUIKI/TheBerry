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
  GripVertical,
  Sliders,
  ChevronDown,
  ChevronRight,
  Eye,
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
};

export function Sidebar() {
  const { activeView, setActiveView, dataDir } = useApp();
  const { t, language } = useI18n();
  const { success } = useToast();

  const [sidebarItems, setSidebarItems] = createSignal<NavItemConfig[]>([]);
  const [showHiddenDrawer, setShowHiddenDrawer] = createSignal(false);

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = createSignal<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);
  const [dropPosition, setDropPosition] = createSignal<"before" | "after" | null>(null);

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

  onMount(() => {
    reloadNav();
    const handleNavChange = () => reloadNav();
    window.addEventListener("navigation-state-changed", handleNavChange);
    onCleanup(() => {
      window.removeEventListener("navigation-state-changed", handleNavChange);
    });
  });

  const visibleItems = () => sidebarItems().filter((item) => !item.hidden);
  const hiddenItems = () => sidebarItems().filter((item) => item.hidden);

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

  // Drag and drop handlers with dynamic position sensing
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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";
    setDragOverIndex(index);
    setDropPosition(pos);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    const startIndex = draggedIndex();
    const pos = dropPosition() || "before";
    if (startIndex !== null && startIndex !== dropIndex) {
      let targetIndex = dropIndex;
      if (startIndex < dropIndex) {
        targetIndex = pos === "before" ? dropIndex - 1 : dropIndex;
      } else {
        targetIndex = pos === "before" ? dropIndex : dropIndex + 1;
      }
      if (startIndex !== targetIndex && targetIndex >= 0 && targetIndex < visibleItems().length) {
        const updated = reorderSidebarItems(startIndex, targetIndex);
        setSidebarItems(updated);
      }
    }
    handleDragEnd();
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
            language() === "zh" ? "已隐藏" : "Hidden",
            language() === "zh"
              ? `"${label}" 已移至收纳箱，可在侧边栏底部找回`
              : `"${label}" moved to stored items`
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
            title={language() === "zh" ? "管理侧边栏导航与排序" : "Manage sidebar navigation & ordering"}
          >
            <Sliders size={12} />
          </button>
        </div>

        {/* Visible Items with Drag & Drop Reordering */}
        <div class="space-y-0.5">
          <For each={visibleItems()}>
            {(item, index) => {
              const isActive = () => activeView() === item.id;
              const Icon = getItemIcon(item.id);
              const isDragged = () => draggedIndex() === index();
              const isOver = () => dragOverIndex() === index();

              return (
                <div
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index())}
                  onDragOver={(e) => handleDragOver(e, index())}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index())}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  class={`group relative flex items-center rounded-md transition-all duration-200 ${
                    isDragged()
                      ? "drag-item-active"
                      : isOver()
                      ? dropPosition() === "before"
                        ? "translate-y-0.5 bg-primary/5"
                        : "-translate-y-0.5 bg-primary/5"
                      : "hover:translate-x-0.5"
                  }`}
                >
                  {/* Dynamic Drop Indicator Line */}
                  <Show when={isOver() && !isDragged()}>
                    <div
                      class={`drop-indicator-line ${
                        dropPosition() === "before" ? "-top-[1.5px]" : "-bottom-[1.5px]"
                      }`}
                    >
                      <span class="drop-indicator-pill-left" />
                      <span class="drop-indicator-pill-right" />
                    </div>
                  </Show>

                  <button
                    onClick={() => handleItemClick(item)}
                    class={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                      isActive()
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <Icon
                      size={15}
                      class={`flex-shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                        isActive() ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    />
                    <span class="truncate text-left flex-1">{getItemLabel(item)}</span>
                  </button>

                  {/* Tactile Drag Handle with hover zoom & grab feedback */}
                  <span
                    class="drag-grip-handle opacity-0 group-hover:opacity-70 hover:!opacity-100 absolute right-2 text-muted-foreground/80 p-1 rounded hover:bg-background/80 hover:text-primary transition-all duration-150"
                    title={language() === "zh" ? "拖动排序 / 右键更多" : "Drag to reorder / Right click"}
                  >
                    <GripVertical size={13} />
                  </span>
                </div>
              );
            }}
          </For>
        </div>

        {/* Hidden / Stored Items Drawer Section */}
        <Show when={hiddenItems().length > 0}>
          <div class="pt-2 mt-1 border-t border-sidebar-border/60">
            <button
              onClick={() => setShowHiddenDrawer((prev) => !prev)}
              class="w-full flex items-center justify-between px-3 py-1.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <div class="flex items-center space-x-1.5">
                <ChevronRight
                  size={12}
                  class={`transition-transform duration-200 ${showHiddenDrawer() ? "rotate-90" : ""}`}
                />
                <span>
                  {language() === "zh"
                    ? `已收纳工具 (${hiddenItems().length})`
                    : `Stored Utilities (${hiddenItems().length})`}
                </span>
              </div>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                {hiddenItems().length}
              </span>
            </button>

            {/* Expanded list of hidden tools */}
            <Show when={showHiddenDrawer()}>
              <div class="mt-1 space-y-0.5 pl-2 animate-in slide-in-from-top-1 duration-200">
                <For each={hiddenItems()}>
                  {(item) => {
                    const Icon = getItemIcon(item.id);
                    return (
                      <div class="group flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-150 hover:translate-x-0.5">
                        <button
                          onClick={() => handleItemClick(item)}
                          class="flex items-center space-x-2 truncate flex-1 text-left"
                          title={language() === "zh" ? "打开此工具" : "Open tool"}
                        >
                          <Icon size={14} class="flex-shrink-0 text-muted-foreground" />
                          <span class="truncate text-[11px]">{getItemLabel(item)}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSidebarItemHidden(item.id, false);
                            success(
                              language() === "zh" ? "已放回侧边栏" : "Restored",
                              language() === "zh"
                                ? `"${getItemLabel(item)}" 已恢复显示在侧边栏`
                                : `"${getItemLabel(item)}" restored to sidebar`
                            );
                          }}
                          class="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/20 text-primary rounded transition-all"
                          title={language() === "zh" ? "恢复并放回侧边栏" : "Restore to sidebar"}
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Bottom info & Settings */}
      <div class="p-2 border-t border-sidebar-border space-y-1 flex-shrink-0">
        {dataDir() && (
          <div
            title={`Root Data: ${dataDir()}`}
            class="flex items-center space-x-2 px-3 py-1.5 text-[11px] text-muted-foreground truncate rounded bg-background/50 border border-border/50"
          >
            <FolderDot size={13} class="flex-shrink-0 text-primary" />
            <span class="truncate">{dataDir()?.split(/[\\/]/).pop() || "BerryAppData"}</span>
          </div>
        )}

        <button
          onClick={() => setActiveView("settings")}
          class={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeView() === "settings"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Settings
            size={16}
            class={activeView() === "settings" ? "text-primary-foreground" : "text-muted-foreground"}
          />
          <span>{t("nav.settings")}</span>
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
