import { createMemo, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import {
  Archive,
  Braces,
  CheckCircle2,
  FileImage,
  FileOutput,
  FileScan,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  FolderSync,
  Image as ImageIcon,
  QrCode,
  Search,
  Star,
  Tags,
  Type,
  Wrench,
  Pin,
  PinOff,
  GripVertical,
  RotateCcw,
  Sliders,
  ArrowUpDown,
  Rocket,
} from "lucide-solid";
import { ContextMenu, ContextMenuItem } from "../components/common/ContextMenu";
import { useApp } from "../context/AppContext";
import { useI18n } from "../context/I18nContext";
import { useToast } from "../context/ToastContext";
import { FileHashModal } from "../components/toolbox/FileHashModal";
import { BatchRenameModal } from "../components/toolbox/BatchRenameModal";
import { QrCodeModal } from "../components/toolbox/QrCodeModal";
import { StructuredDataModal } from "../components/toolbox/StructuredDataModal";
import {
  loadNavigationConfig,
  saveNavigationConfig,
  reorderToolboxTools,
  pinToSidebar,
  unpinFromSidebar,
} from "../services/navigation";

type ToolCategory = "convert" | "document" | "image" | "text" | "system";

interface LocalizedText {
  zh: string;
  en: string;
}

interface ToolDefinition {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  category: ToolCategory;
  tags: string[];
  icon: typeof ImageIcon;
  available?: boolean;
}

const categories: Array<{ id: "all" | ToolCategory; label: LocalizedText }> = [
  { id: "all", label: { zh: "全部", en: "All" } },
  { id: "convert", label: { zh: "格式转换", en: "Conversion" } },
  { id: "document", label: { zh: "文档处理", en: "Documents" } },
  { id: "image", label: { zh: "图片工具", en: "Images" } },
  { id: "text", label: { zh: "文本数据", en: "Text & Data" } },
  { id: "system", label: { zh: "系统工具", en: "System" } },
];

const tools: ToolDefinition[] = [
  {
    id: "image-converter",
    name: { zh: "图片格式转换", en: "Image Converter" },
    description: { zh: "批量转换 PNG、JPG、WebP 等图片格式", en: "Batch convert PNG, JPG, WebP and more" },
    category: "convert",
    tags: ["PNG", "JPG", "WebP"],
    icon: FileImage,
    available: true,
  },
  {
    id: "pdf-to-images",
    name: { zh: "PDF 转图片", en: "PDF to Images" },
    description: { zh: "按页导出为 PNG 或 JPG 图片", en: "Export PDF pages as PNG or JPG images" },
    category: "convert",
    tags: ["PDF", "PNG", "JPG"],
    icon: FileOutput,
  },
  {
    id: "pdf-organizer",
    name: { zh: "PDF 合并拆分", en: "Merge & Split PDF" },
    description: { zh: "合并多个 PDF 或按页面范围拆分", en: "Merge PDFs or split them by page range" },
    category: "document",
    tags: ["PDF", "合并", "拆分"],
    icon: Archive,
  },
  {
    id: "word-to-pdf",
    name: { zh: "Word 转 PDF", en: "Word to PDF" },
    description: { zh: "将 DOCX 文档转换为便携 PDF", en: "Convert DOCX documents to portable PDFs" },
    category: "convert",
    tags: ["DOCX", "PDF"],
    icon: FileText,
  },
  {
    id: "sheet-converter",
    name: { zh: "Excel / CSV 转换", en: "Excel / CSV Converter" },
    description: { zh: "在 XLSX、CSV 与 TSV 之间快速转换", en: "Convert between XLSX, CSV and TSV" },
    category: "convert",
    tags: ["XLSX", "CSV", "TSV"],
    icon: FileSpreadsheet,
  },
  {
    id: "batch-rename",
    name: { zh: "批量重命名", en: "Batch Rename" },
    description: { zh: "使用规则统一整理大量文件名称", en: "Rename large file sets with reusable rules" },
    category: "system",
    tags: ["文件", "规则", "批处理"],
    icon: Tags,
    available: true,
  },
  {
    id: "folder-sync",
    name: { zh: "文件夹同步与比对", en: "Folder Sync & Comparison" },
    description: { zh: "双向/镜像同步，多线程哈希比对与实时监控", en: "Two-way/mirror sync with hash comparison and RealTimeSync" },
    category: "system",
    tags: ["同步", "备份", "FreeFileSync", "比对"],
    icon: FolderSync,
    available: true,
  },
  {
    id: "file-search",
    name: { zh: "文件极速搜索", en: "File Search" },
    description: { zh: "全盘极速检索，毫秒级定位文件与目录", en: "Instant full-disk search for files and folders" },
    category: "system",
    tags: ["搜索", "文件", "Search", "极速"],
    icon: Search,
    available: true,
  },
  {
    id: "image-compressor",
    name: { zh: "图片压缩", en: "Image Compressor" },
    description: { zh: "在保持观感的同时减小图片体积", en: "Reduce image size while preserving quality" },
    category: "image",
    tags: ["压缩", "PNG", "JPG"],
    icon: ImageIcon,
  },
  {
    id: "ocr",
    name: { zh: "OCR 文字识别", en: "OCR Text Recognition" },
    description: { zh: "从截图和扫描件中提取可编辑文字", en: "Extract editable text from scans and images" },
    category: "document",
    tags: ["OCR", "扫描", "文字"],
    icon: FileScan,
  },
  {
    id: "markdown-converter",
    name: { zh: "Markdown 转换", en: "Markdown Converter" },
    description: { zh: "在 Markdown、HTML 与纯文本间转换", en: "Convert Markdown, HTML and plain text" },
    category: "text",
    tags: ["MD", "HTML", "TXT"],
    icon: Type,
  },
  {
    id: "structured-data",
    name: { zh: "JSON / YAML 转换", en: "JSON / YAML Converter" },
    description: { zh: "转换、格式化并校验结构化数据", en: "Convert, format and validate structured data" },
    category: "text",
    tags: ["JSON", "YAML", "格式化"],
    icon: Braces,
    available: true,
  },
  {
    id: "qr-code",
    name: { zh: "二维码工具", en: "QR Code Tools" },
    description: { zh: "生成二维码并识别图片中的内容", en: "Create QR codes and read them from images" },
    category: "image",
    tags: ["QR", "生成", "识别"],
    icon: QrCode,
    available: true,
  },
  {
    id: "file-hash",
    name: { zh: "文件哈希", en: "File Hash" },
    description: { zh: "计算并比对文件的 MD5、SHA 哈希", en: "Calculate and compare MD5 and SHA hashes" },
    category: "system",
    tags: ["MD5", "SHA256", "校验"],
    icon: Fingerprint,
    available: true,
  },
];

const recentToolIds = ["image-converter", "ocr", "markdown-converter"];

export function ToolboxView() {
  const { setActiveView } = useApp();
  const { language } = useI18n();
  const { info, success } = useToast();
  const [query, setQuery] = createSignal("");
  const [category, setCategory] = createSignal<"all" | ToolCategory>("all");
  const [favorites, setFavorites] = createSignal(new Set(["image-converter", "markdown-converter"]));

  const [activeModal, setActiveModal] = createSignal<"file-hash" | "batch-rename" | "qr-code" | "structured-data" | null>(null);

  const [customToolOrder, setCustomToolOrder] = createSignal<string[]>([]);
  const [sidebarPinnedIds, setSidebarPinnedIds] = createSignal<Set<string>>(new Set());

  // Pointer-based Drag & Drop state
  let gridContainerRef: HTMLDivElement | undefined;
  let pressTimer: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragStartIndex: number | null = null;
  const [isPointerDragging, setIsPointerDragging] = createSignal(false);
  const [draggedToolIndex, setDraggedToolIndex] = createSignal<number | null>(null);
  const [dragOverToolIndex, setDragOverToolIndex] = createSignal<number | null>(null);

  // Floating Context Menu
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    isOpen: boolean;
    tool: ToolDefinition | null;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    tool: null,
  });

  const localize = (text: LocalizedText) => text[language()];

  const resolveNavId = (id: string): string => {
    const cfg = loadNavigationConfig();
    if (cfg.sidebarItems.some((it) => it.id === id)) return id;
    const under = id.replace(/-/g, "_");
    if (cfg.sidebarItems.some((it) => it.id === under)) return under;
    const hyphen = id.replace(/_/g, "-");
    if (cfg.sidebarItems.some((it) => it.id === hyphen)) return hyphen;
    return id;
  };

  const reloadNavState = () => {
    const cfg = loadNavigationConfig();
    setCustomToolOrder(cfg.toolboxOrder || []);
    const pinned = new Set(cfg.sidebarItems.filter((it) => !it.hidden).map((it) => it.id));
    setSidebarPinnedIds(pinned);
  };

  onMount(() => {
    reloadNavState();
    const handleNavChange = () => reloadNavState();
    window.addEventListener("navigation-state-changed", handleNavChange);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    const handleOpenToolEvent = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail) {
        const targetTool = tools.find((t) => t.id === ce.detail);
        if (targetTool) openTool(targetTool);
      }
    };
    window.addEventListener("open-toolbox-tool", handleOpenToolEvent);

    onCleanup(() => {
      window.removeEventListener("navigation-state-changed", handleNavChange);
      window.removeEventListener("open-toolbox-tool", handleOpenToolEvent);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      if (pressTimer) clearTimeout(pressTimer);
    });
  });

  const orderedBaseTools = createMemo(() => {
    const order = customToolOrder();
    if (!order || order.length === 0) return tools;

    const map = new Map(tools.map((t) => [t.id, t]));
    const result: ToolDefinition[] = [];

    order.forEach((id) => {
      const t = map.get(id);
      if (t) {
        result.push(t);
        map.delete(id);
      }
    });

    map.forEach((t) => result.push(t));
    return result;
  });

  const filteredTools = createMemo(() => {
    const normalizedQuery = query().trim().toLocaleLowerCase();

    return orderedBaseTools().filter((tool) => {
      const categoryMatches = category() === "all" || tool.category === category();
      if (!categoryMatches) return false;

      if (!normalizedQuery) return true;

      return [tool.name.zh, tool.name.en, tool.description.zh, tool.description.en, ...tool.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  });

  const recentTools = createMemo(() =>
    recentToolIds
      .map((id) => tools.find((tool) => tool.id === id))
      .filter((tool): tool is ToolDefinition => Boolean(tool))
  );

  const openTool = (tool: ToolDefinition) => {
    if (tool.id === "image-converter") {
      setActiveView("image_converter");
      return;
    }
    if (tool.id === "folder-sync") {
      setActiveView("folder_sync");
      return;
    }
    if (tool.id === "file-search") {
      setActiveView("file_search");
      return;
    }
    if (tool.id === "file-hash") {
      setActiveModal("file-hash");
      return;
    }
    if (tool.id === "batch-rename") {
      setActiveModal("batch-rename");
      return;
    }
    if (tool.id === "qr-code") {
      setActiveModal("qr-code");
      return;
    }
    if (tool.id === "structured-data") {
      setActiveModal("structured-data");
      return;
    }

    info(
      language() === "zh" ? "该工具仍在开发中" : "This tool is still in development",
      localize(tool.name)
    );
  };

  const toggleFavorite = (tool: ToolDefinition) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(tool.id)) next.delete(tool.id);
      else next.add(tool.id);
      return next;
    });
  };

  // Pointer-based Drag & Drop
  const handleToolPointerDown = (e: PointerEvent, index: number) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button")) return;

    startX = e.clientX;
    startY = e.clientY;
    dragStartIndex = index;

    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      setIsPointerDragging(true);
      setDraggedToolIndex(index);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }, 150);
  };

  const handleWindowPointerMove = (e: PointerEvent) => {
    if (dragStartIndex === null) return;

    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);

    if (!isPointerDragging() && (dx > 4 || dy > 4)) {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      setIsPointerDragging(true);
      setDraggedToolIndex(dragStartIndex);
    }

    if (isPointerDragging() && gridContainerRef) {
      const cardEls = gridContainerRef.querySelectorAll<HTMLElement>("[data-tool-index]");
      let foundIndex: number | null = null;

      cardEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const raw = el.getAttribute("data-tool-index");
          if (raw !== null) foundIndex = parseInt(raw, 10);
        }
      });

      setDragOverToolIndex(foundIndex);
    }
  };

  const handleWindowPointerUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    if (dragStartIndex !== null && isPointerDragging()) {
      const from = draggedToolIndex();
      const to = dragOverToolIndex();
      if (from !== null && to !== null && from !== to) {
        const currentOrder = orderedBaseTools().map((t) => t.id);
        const updatedOrder = reorderToolboxTools(from, to, currentOrder);
        setCustomToolOrder(updatedOrder);
        success(
          language() === "zh" ? "排序已更新" : "Order Updated",
          language() === "zh" ? "工具箱排列顺序已保存" : "Toolbox tools reordered"
        );
      }
    }

    setIsPointerDragging(false);
    setDraggedToolIndex(null);
    setDragOverToolIndex(null);
    dragStartIndex = null;
  };

  // Card Context Menu
  const handleCardContextMenu = (e: MouseEvent, tool: ToolDefinition) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      tool,
    });
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    const tool = contextMenu().tool;
    if (!tool) return [];

    const navId = resolveNavId(tool.id);
    const isPinned = sidebarPinnedIds().has(tool.id) || sidebarPinnedIds().has(navId);
    const isFav = favorites().has(tool.id);

    return [
      {
        id: "pin",
        label: isPinned
          ? language() === "zh"
            ? "从左侧菜单栏取消固定"
            : "Unpin from Sidebar"
          : language() === "zh"
          ? "固定到左侧菜单栏"
          : "Pin to Sidebar",
        icon: isPinned ? PinOff : Pin,
        onClick: () => {
          handleTogglePin(tool);
        },
      },
      {
        id: "open",
        label: language() === "zh" ? "打开此工具" : "Open Tool",
        icon: Rocket,
        onClick: () => {
          openTool(tool);
        },
      },
      {
        id: "favorite",
        label: isFav
          ? language() === "zh"
            ? "取消收藏"
            : "Remove from Favorites"
          : language() === "zh"
          ? "加入收藏"
          : "Add to Favorites",
        icon: Star,
        onClick: () => {
          toggleFavorite(tool);
        },
      },
      {
        id: "divider",
        label: "",
        divider: true,
      },
      {
        id: "manage_nav",
        label: language() === "zh" ? "管理侧边栏导航..." : "Manage Sidebar Navigation...",
        icon: Sliders,
        onClick: () => {
          window.dispatchEvent(new CustomEvent("open-navigation-manager"));
        },
      },
    ];
  };

  const handleResetToolboxOrder = () => {
    const current = loadNavigationConfig();
    saveNavigationConfig({
      ...current,
      toolboxOrder: [],
    });
    setCustomToolOrder([]);
    info(
      language() === "zh" ? "已恢复默认排序" : "Order Reset",
      language() === "zh" ? "工具箱已恢复官方默认排列" : "Toolbox tools reset to default order"
    );
  };

  const handleTogglePin = (tool: ToolDefinition) => {
    const navId = resolveNavId(tool.id);
    const isPinned = sidebarPinnedIds().has(tool.id) || sidebarPinnedIds().has(navId);
    if (isPinned) {
      unpinFromSidebar(navId);
      success(
        language() === "zh" ? "已从侧边栏移除" : "Unpinned from Sidebar",
        language() === "zh"
          ? `"${localize(tool.name)}" 已从左侧侧边栏取消固定`
          : `"${localize(tool.name)}" unpinned from sidebar`
      );
    } else {
      pinToSidebar(navId);
      success(
        language() === "zh" ? "已固定至左侧侧边栏" : "Pinned to Sidebar",
        language() === "zh"
          ? `"${localize(tool.name)}" 已固定至左侧侧边栏`
          : `"${localize(tool.name)}" pinned to sidebar`
      );
    }
    reloadNavState();
  };

  return (
    <div class="h-full flex flex-col p-6 space-y-4 overflow-hidden">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-lg font-bold text-foreground flex items-center space-x-2">
            <Wrench class="text-primary" size={20} />
            <span>{language() === "zh" ? "工具箱" : "Toolbox"}</span>
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            {language() === "zh"
              ? "集中管理你开发的办公与效率工具"
              : "Manage your office and productivity tools in one place"}
          </p>
        </div>

        <label class="relative w-64 max-w-full">
          <span class="sr-only">{language() === "zh" ? "搜索工具" : "Search tools"}</span>
          <Search
            size={14}
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder={language() === "zh" ? "搜索名称、格式或用途..." : "Search by name, format or use..."}
            class="w-full h-8 pl-8 pr-3 bg-card border border-input rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>

      <div class="flex items-center gap-1.5 flex-wrap" role="group" aria-label={language() === "zh" ? "工具分类" : "Tool categories"}>
        <For each={categories}>
          {(item) => (
            <button
              type="button"
              aria-pressed={category() === item.id}
              onClick={() => setCategory(item.id)}
              class={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                category() === item.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
              }`}
            >
              {localize(item.label)}
            </button>
          )}
        </For>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-xs font-semibold text-foreground">
            {language() === "zh" ? "最近使用" : "Recently used"}
          </h2>
          <span class="text-[11px] text-muted-foreground">
            {language() === "zh" ? "快速继续上次工作" : "Continue where you left off"}
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <For each={recentTools()}>
            {(tool) => {
              const Icon = tool.icon;
              return (
                <button
                  type="button"
                  onClick={() => openTool(tool)}
                  class="flex items-center gap-2.5 p-2.5 bg-card border border-border rounded-lg text-left hover:border-primary/40 hover:bg-primary/[0.03] transition-colors shadow-sm"
                >
                  <span class="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon size={16} />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-xs font-semibold text-foreground truncate">{localize(tool.name)}</span>
                    <span class="block text-[11px] text-muted-foreground truncate">
                      {tool.available
                        ? language() === "zh" ? "可立即使用" : "Ready to use"
                        : language() === "zh" ? "查看开发状态" : "View development status"}
                    </span>
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto pr-1">
        <div class="flex items-center justify-between mb-2 sticky top-0 bg-background py-1 z-10">
          <div class="flex items-center space-x-2">
            <h2 class="text-xs font-semibold text-foreground">
              {language() === "zh" ? "全部工具" : "All tools"}
            </h2>
            <span class="text-[11px] text-muted-foreground">
              {language() === "zh"
                ? `(可拖动排序，共 ${filteredTools().length} 个)`
                : `(drag to reorder, ${filteredTools().length} tools)`}
            </span>
          </div>

          <div class="flex items-center space-x-2">
            <Show when={customToolOrder().length > 0}>
              <button
                type="button"
                onClick={handleResetToolboxOrder}
                class="px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center space-x-1 transition-colors border border-border/50"
                title={language() === "zh" ? "恢复默认排列顺序" : "Reset tools to default order"}
              >
                <RotateCcw size={11} />
                <span>{language() === "zh" ? "恢复排序" : "Reset Order"}</span>
              </button>
            </Show>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open-navigation-manager"))}
              class="px-2.5 py-1 rounded text-[11px] font-medium text-primary hover:text-primary-foreground hover:bg-primary border border-primary/30 flex items-center space-x-1.5 transition-colors shadow-sm"
              title={language() === "zh" ? "管理侧边栏导航与收纳" : "Manage sidebar navigation"}
            >
              <Sliders size={12} />
              <span>{language() === "zh" ? "管理侧边栏导航" : "Sidebar Manager"}</span>
            </button>
          </div>
        </div>

        <Show
          when={filteredTools().length > 0}
          fallback={
            <div class="h-40 bg-card border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center px-4">
              <Search size={24} class="text-muted-foreground/60 mb-2" />
              <p class="text-xs font-semibold text-foreground">
                {language() === "zh" ? "没有找到匹配的工具" : "No matching tools found"}
              </p>
              <p class="text-[11px] text-muted-foreground mt-1">
                {language() === "zh" ? "请尝试其他关键词或分类" : "Try another keyword or category"}
              </p>
            </div>
          }
        >
          <div ref={gridContainerRef} class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-1">
            <For each={filteredTools()}>
              {(tool, index) => {
                const Icon = tool.icon;
                const isFavorite = () => favorites().has(tool.id);
                const isPinned = () => {
                  const navId = resolveNavId(tool.id);
                  return sidebarPinnedIds().has(tool.id) || sidebarPinnedIds().has(navId);
                };
                const isDragged = () => draggedToolIndex() === index();
                const isOver = () => dragOverToolIndex() === index();

                return (
                  <article
                    data-tool-index={index()}
                    onPointerDown={(e) => handleToolPointerDown(e, index())}
                    onContextMenu={(e) => handleCardContextMenu(e, tool)}
                    class={`group relative p-3 bg-card border rounded-lg shadow-sm flex flex-col min-h-36 select-none cursor-default transition-all duration-200 touch-none ${
                      isDragged()
                        ? "tool-card-dragging scale-95 opacity-70 border-primary shadow-xl ring-2 ring-primary/40 z-30"
                        : isOver()
                        ? "tool-card-over border-primary ring-2 ring-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/40 hover:-translate-y-1 hover:shadow-md"
                    }`}
                  >
                    {/* Drag Hover Swap Indicator Overlay */}
                    <Show when={isOver() && !isDragged()}>
                      <div class="absolute inset-0 rounded-lg bg-primary/10 border-2 border-primary pointer-events-none flex items-center justify-center animate-in fade-in zoom-in-95 duration-150 z-20">
                        <span class="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-lg flex items-center space-x-1.5 animate-pulse">
                          <ArrowUpDown size={12} />
                          <span>{language() === "zh" ? "放到此处交换排序" : "Drop to reorder"}</span>
                        </span>
                      </div>
                    </Show>

                    <div class="flex items-start gap-2.5">
                      <span class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                        <Icon size={18} />
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 min-w-0 flex-wrap">
                          <h3 class="text-xs font-semibold text-foreground truncate">{localize(tool.name)}</h3>
                          <span class={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            tool.available
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            {tool.available && <CheckCircle2 size={10} />}
                            {tool.available
                              ? language() === "zh" ? "已可用" : "Available"
                              : language() === "zh" ? "开发中" : "In development"}
                          </span>
                        </div>
                        <p class="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-1">
                          {localize(tool.description)}
                        </p>
                      </div>

                      {/* Card Actions: Pin to Sidebar + Favorite + Drag Grip */}
                      <div class="flex items-center space-x-1 flex-shrink-0">
                        {/* Pin / Unpin to Sidebar */}
                        <button
                          type="button"
                          onClick={() => handleTogglePin(tool)}
                          class={`p-1 rounded hover:bg-secondary transition-colors ${
                            isPinned() ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
                          }`}
                          title={
                            isPinned()
                              ? language() === "zh"
                                ? "已固定在侧边栏 (点击取消固定)"
                                : "Pinned in sidebar (click to unpin)"
                              : language() === "zh"
                              ? "固定至左侧侧边栏"
                              : "Pin to sidebar"
                          }
                        >
                          <Show when={isPinned()} fallback={<PinOff size={13} />}>
                            <Pin size={13} class="fill-current" />
                          </Show>
                        </button>

                        {/* Favorite button */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(tool)}
                          class={`p-1 rounded hover:bg-secondary transition-colors ${
                            isFavorite() ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
                          }`}
                          title={
                            language() === "zh"
                              ? isFavorite()
                                ? "取消收藏"
                                : "收藏"
                              : isFavorite()
                              ? "Remove favorite"
                              : "Add favorite"
                          }
                        >
                          <Star size={13} fill={isFavorite() ? "currentColor" : "none"} />
                        </button>

                        {/* Tactile Grip Drag Handle */}
                        <span
                          class="drag-grip-handle text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded hover:bg-secondary/60 transition-colors"
                          title={language() === "zh" ? "按住拖动排序" : "Drag to reorder"}
                        >
                          <GripVertical size={14} />
                        </span>
                      </div>
                    </div>

                    <div class="mt-auto pt-3 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1 overflow-hidden">
                        <For each={tool.tags.slice(0, 3)}>
                          {(tag) => <span class="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[10px] font-mono truncate">{tag}</span>}
                        </For>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTool(tool)}
                        class={`px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 transition-colors ${
                          tool.available
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                        }`}
                      >
                        {language() === "zh" ? "打开" : "Open"}
                      </button>
                    </div>
                  </article>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Floating Context Menu for Tool Cards */}
      <ContextMenu
        x={contextMenu().x}
        y={contextMenu().y}
        isOpen={contextMenu().isOpen}
        items={contextMenu().tool ? getContextMenuItems() : []}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
      />
      <FileHashModal
        isOpen={activeModal() === "file-hash"}
        onClose={() => setActiveModal(null)}
      />
      <BatchRenameModal
        isOpen={activeModal() === "batch-rename"}
        onClose={() => setActiveModal(null)}
      />
      <QrCodeModal
        isOpen={activeModal() === "qr-code"}
        onClose={() => setActiveModal(null)}
      />
      <StructuredDataModal
        isOpen={activeModal() === "structured-data"}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}
