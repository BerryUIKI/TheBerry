export interface NavItemConfig {
  id: string;
  customName?: string;
  hidden: boolean;
  order: number;
}

export interface NavigationState {
  sidebarItems: NavItemConfig[];
  toolboxOrder: string[];
}

export const DEFAULT_SIDEBAR_ORDER: string[] = [
  "clipboard",
  "snippets",
  "launcher",
  "image_converter",
  "file_search",
  "folder_sync",
  "toolbox",
];

export interface NavItemMeta {
  id: string;
  defaultKey: string;
  name: { zh: string; en: string };
  iconName: string;
  isView: boolean;
}

export const KNOWN_NAV_ITEMS: Record<string, NavItemMeta> = {
  clipboard: {
    id: "clipboard",
    defaultKey: "nav.clipboard",
    name: { zh: "剪贴板历史", en: "Clipboard History" },
    iconName: "ClipboardList",
    isView: true,
  },
  snippets: {
    id: "snippets",
    defaultKey: "nav.snippets",
    name: { zh: "代码片段", en: "Snippets" },
    iconName: "Code2",
    isView: true,
  },
  launcher: {
    id: "launcher",
    defaultKey: "nav.launcher",
    name: { zh: "快捷启动", en: "App Launcher" },
    iconName: "Rocket",
    isView: true,
  },
  image_converter: {
    id: "image_converter",
    defaultKey: "nav.image_converter",
    name: { zh: "图片格式转换", en: "Image Converter" },
    iconName: "ImageIcon",
    isView: true,
  },
  file_search: {
    id: "file_search",
    defaultKey: "nav.file_search",
    name: { zh: "文件极速搜索", en: "File Search" },
    iconName: "Search",
    isView: true,
  },
  folder_sync: {
    id: "folder_sync",
    defaultKey: "nav.folder_sync",
    name: { zh: "文件夹同步比对", en: "Folder Sync" },
    iconName: "FolderSync",
    isView: true,
  },
  toolbox: {
    id: "toolbox",
    defaultKey: "nav.toolbox",
    name: { zh: "工具箱", en: "Toolbox Hub" },
    iconName: "Boxes",
    isView: true,
  },
  // Additional toolbox sub-tools that can be pinned to sidebar
  "batch-rename": {
    id: "batch-rename",
    defaultKey: "toolbox.batch_rename",
    name: { zh: "批量重命名", en: "Batch Rename" },
    iconName: "Tags",
    isView: false,
  },
  "file-hash": {
    id: "file-hash",
    defaultKey: "toolbox.file_hash",
    name: { zh: "文件哈希校验", en: "File Hash" },
    iconName: "Fingerprint",
    isView: false,
  },
  "qr-code": {
    id: "qr-code",
    defaultKey: "toolbox.qr_code",
    name: { zh: "二维码工具", en: "QR Code Tools" },
    iconName: "QrCode",
    isView: false,
  },
  "structured-data": {
    id: "structured-data",
    defaultKey: "toolbox.structured_data",
    name: { zh: "JSON/YAML 转换", en: "JSON/YAML Tools" },
    iconName: "Braces",
    isView: false,
  },
  "pdf-to-images": {
    id: "pdf-to-images",
    defaultKey: "toolbox.pdf_to_images",
    name: { zh: "PDF 转图片", en: "PDF to Images" },
    iconName: "FileOutput",
    isView: false,
  },
  "pdf-organizer": {
    id: "pdf-organizer",
    defaultKey: "toolbox.pdf_organizer",
    name: { zh: "PDF 合并拆分", en: "Merge & Split PDF" },
    iconName: "Archive",
    isView: false,
  },
  "word-to-pdf": {
    id: "word-to-pdf",
    defaultKey: "toolbox.word_to_pdf",
    name: { zh: "Word 转 PDF", en: "Word to PDF" },
    iconName: "FileText",
    isView: false,
  },
  "sheet-converter": {
    id: "sheet-converter",
    defaultKey: "toolbox.sheet_converter",
    name: { zh: "Excel / CSV 转换", en: "Excel / CSV Converter" },
    iconName: "FileSpreadsheet",
    isView: false,
  },
  "image-compressor": {
    id: "image-compressor",
    defaultKey: "toolbox.image_compressor",
    name: { zh: "图片压缩", en: "Image Compressor" },
    iconName: "ImageIcon",
    isView: false,
  },
  ocr: {
    id: "ocr",
    defaultKey: "toolbox.ocr",
    name: { zh: "OCR 文字识别", en: "OCR Text Recognition" },
    iconName: "FileScan",
    isView: false,
  },
  "markdown-converter": {
    id: "markdown-converter",
    defaultKey: "toolbox.markdown_converter",
    name: { zh: "Markdown 转换", en: "Markdown Converter" },
    iconName: "Type",
    isView: false,
  },
};
