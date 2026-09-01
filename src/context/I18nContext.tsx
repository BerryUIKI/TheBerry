import { createContext, createSignal, JSX, useContext, onMount, createEffect } from "solid-js";
import { getConfig, updateConfig } from "../services/system";

export type AppLanguage = "en" | "zh";

const TRANSLATIONS = {
  en: {
    // Navigation
    "nav.clipboard": "Clipboard",
    "nav.snippets": "Snippets",
    "nav.launcher": "App Launcher",
    "nav.image_converter": "Image Converter",
    "nav.file_search": "File Search",
    "nav.settings": "Settings",

    // TitleBar
    "titlebar.search": "Search",
    "titlebar.ai_assistant": "TheBerry AI",
    "titlebar.shortcuts": "Shortcuts",
    "titlebar.toggle_theme": "Toggle Theme",

    // Assistant
    "ai.name": "TheBerry",
    "ai.full_name": "TheBerry AI",
    "ai.drawer_title": "TheBerry AI Assistant",
    "ai.subtitle": "Ask coding questions, refactor snippets, summarize files, or automate desktop operations.",
    "ai.placeholder": "Ask TheBerry ({model})...",
    "ai.placeholder_generic": "Ask TheBerry anything...",
    "ai.configure_provider": "Configure Provider",
    "ai.direct_ready": "Direct LLM Ready",
    "ai.daemon_active": "Goose Daemon Active",
    "ai.clear_history": "Clear Chat History",
    "ai.close_drawer": "Close Assistant (Esc)",
    "ai.user_name_default": "You",
    "ai.press_enter": "Press Enter to send",

    // Settings View
    "settings.title": "Preferences & Settings",
    "settings.subtitle": "Manage application configuration, themes, backups, and external integrations.",
    "settings.general": "General Preferences",
    "settings.language": "Interface Language",
    "settings.language_desc": "Select the display language for the interface and AI assistant.",
    "settings.theme": "Theme Appearance",
    "settings.theme_dark": "Dark",
    "settings.theme_light": "Light",
    "settings.theme_system": "System",
    "settings.close_to_tray": "Close to System Tray",
    "settings.close_to_tray_desc": "Minimize / close to system tray instead of exiting",
    "settings.autostart": "Launch at Startup",
    "settings.autostart_desc": "Automatically start TheBerry on system login",
    "settings.data_dir": "Data Directory",
    "settings.data_dir_desc": "Local SQLite & Redb persistent storage location",
    "settings.reveal_explorer": "Reveal in Explorer",
    "settings.backup": "Full Backup & Migration",
    "settings.backup_desc": "Export or import your complete database (clips, snippets, launchers, preferences) as JSON.",
    "settings.export_backup": "Export Backup JSON",
    "settings.import_backup": "Import Backup",
    "settings.quicklook": "QuickLook File Preview (Windows)",
    "settings.quicklook_desc": "Press Space on any file in File Search or Spotlight HUD to launch instant native previews.",
    "settings.ai_assistant": "TheBerry AI & Goose Assistant",
    "settings.ai_desc": "Configure LLM providers (OpenAI, Anthropic, Google Gemini, Ollama, DeepSeek, Groq), credentials, and MCP tools.",
    "settings.configure": "Configure",
    "settings.updater": "Software Update",
    "settings.updater_desc": "Check for new releases and install updates directly.",
    "settings.check_update": "Check for Updates",
    "settings.saved_success": "Settings saved successfully",
  },
  zh: {
    // Navigation
    "nav.clipboard": "剪贴板",
    "nav.snippets": "代码片段",
    "nav.launcher": "应用启动器",
    "nav.image_converter": "图片转换",
    "nav.file_search": "文件搜索",
    "nav.settings": "系统设置",

    // TitleBar
    "titlebar.search": "全局搜索",
    "titlebar.ai_assistant": "豆花 AI",
    "titlebar.shortcuts": "快捷键",
    "titlebar.toggle_theme": "切换主题",

    // Assistant
    "ai.name": "豆花",
    "ai.full_name": "豆花 AI",
    "ai.drawer_title": "豆花 桌面智能助手",
    "ai.subtitle": "解答编程疑惑、重构代码、提炼文件摘要或执行桌面级自动化操作。",
    "ai.placeholder": "向 豆花 提问 ({model})...",
    "ai.placeholder_generic": "向 豆花 提问任何问题...",
    "ai.configure_provider": "配置模型服务",
    "ai.direct_ready": "直连大模型就绪",
    "ai.daemon_active": "Goose 守护进程运行中",
    "ai.clear_history": "清空对话记录",
    "ai.close_drawer": "关闭助手 (Esc)",
    "ai.user_name_default": "你",
    "ai.press_enter": "按 Enter 键发送消息",

    // Settings View
    "settings.title": "偏好设置与系统配置",
    "settings.subtitle": "管理全局设置、主题外观、数据备份与外部扩展集成。",
    "settings.general": "常规设置",
    "settings.language": "界面语言",
    "settings.language_desc": "选择应用程序界面与 AI 智能助手的交互语言。",
    "settings.theme": "主题外观",
    "settings.theme_dark": "深色模式",
    "settings.theme_light": "浅色模式",
    "settings.theme_system": "跟随系统",
    "settings.close_to_tray": "最小化到系统托盘",
    "settings.close_to_tray_desc": "关闭主窗口时最小化至托盘区域，保持后台待命",
    "settings.autostart": "开机自启动",
    "settings.autostart_desc": "系统启动登录时自动在后台启动 TheBerry",
    "settings.data_dir": "数据存储目录",
    "settings.data_dir_desc": "本地 Redb 键值库与 SQLite 核心存储路径",
    "settings.reveal_explorer": "在资源管理器中打开",
    "settings.backup": "完整数据备份与恢复",
    "settings.backup_desc": "将剪贴板、代码片段、快捷启动项及全局配置导出为 JSON 或一键导入恢复。",
    "settings.export_backup": "导出备份 JSON",
    "settings.import_backup": "导入备份",
    "settings.quicklook": "QuickLook 原生文件预览 (Windows)",
    "settings.quicklook_desc": "在文件搜索或全局搜索中选中任意文件，按空格键 (Space) 即可唤起原生快速预览。",
    "settings.ai_assistant": "豆花 AI & Goose 智能助手",
    "settings.ai_desc": "配置大模型供应商（OpenAI、Anthropic、Google Gemini、Ollama、DeepSeek、Groq）、API 密钥与 MCP 插件环境。",
    "settings.configure": "配置助手",
    "settings.updater": "软件检查与更新",
    "settings.updater_desc": "检查 GitHub 最新版本并支持一键下载安装。",
    "settings.check_update": "检查更新",
    "settings.saved_success": "设置保存成功",
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS["en"];

interface I18nContextType {
  language: () => AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  assistantName: () => string;
}

const I18nContext = createContext<I18nContextType>();

export function I18nProvider(props: { children: JSX.Element }) {
  const [language, setLanguageState] = createSignal<AppLanguage>("en");

  onMount(async () => {
    // 1. Check localStorage first
    const saved = localStorage.getItem("berry_language") as AppLanguage | null;
    if (saved === "en" || saved === "zh") {
      setLanguageState(saved);
    }
    // 2. Sync from backend config
    try {
      const cfg = await getConfig();
      if (cfg?.language === "en" || cfg?.language === "zh") {
        setLanguageState(cfg.language);
        localStorage.setItem("berry_language", cfg.language);
      }
    } catch (e) {
      console.warn("Failed to load language from backend config:", e);
    }
  });

  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem("berry_language", lang);
    try {
      await updateConfig({ language: lang });
    } catch (e) {
      console.error("Failed to persist language to backend config:", e);
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    const lang = language();
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    let text = (dict as any)[key] || (TRANSLATIONS.en as any)[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
    }
    return text;
  };

  const assistantName = () => (language() === "zh" ? "豆花" : "TheBerry");

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, assistantName }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
