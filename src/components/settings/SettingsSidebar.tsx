import { For, Show } from "solid-js";
import { SettingsCategory, SettingsCategoryItem } from "../../types/settings";
import { useI18n } from "../../context/I18nContext";
import {
  Settings,
  Keyboard,
  Eye,
  Sparkles,
  ClipboardList,
  HardDrive,
  Info,
  ArrowLeft,
  ExternalLink,
  Search,
  X,
} from "lucide-solid";

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onSelectCategory: (category: SettingsCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isStandalone?: boolean;
  onBack?: () => void;
  onOpenStandalone?: () => void;
}

export const SETTINGS_CATEGORIES: { id: SettingsCategory; labelKey: string; icon: any; keywords: string[] }[] = [
  {
    id: "general",
    labelKey: "settings.category_general",
    icon: Settings,
    keywords: ["language", "theme", "dark", "light", "autostart", "startup", "tray", "minimize"],
  },
  {
    id: "shortcuts",
    labelKey: "settings.category_shortcuts",
    icon: Keyboard,
    keywords: ["hotkey", "shortcuts", "hud", "alt+space", "global", "keyboard"],
  },
  {
    id: "quicklook",
    labelKey: "settings.category_quicklook",
    icon: Eye,
    keywords: ["quicklook", "preview", "space", "daemon", "video", "svg", "markdown"],
  },
  {
    id: "ai",
    labelKey: "settings.category_ai",
    icon: Sparkles,
    keywords: ["ai", "goose", "llm", "gemini", "openai", "claude", "ollama", "mcp"],
  },
  {
    id: "clipboard",
    labelKey: "settings.category_clipboard",
    icon: ClipboardList,
    keywords: ["clipboard", "monitor", "security", "privacy", "history", "password"],
  },
  {
    id: "storage",
    labelKey: "settings.category_storage",
    icon: HardDrive,
    keywords: ["storage", "data", "backup", "restore", "export", "import", "database", "redb"],
  },
  {
    id: "about",
    labelKey: "settings.category_about",
    icon: Info,
    keywords: ["about", "version", "update", "changelog", "github", "release"],
  },
];

export function SettingsSidebar(props: SettingsSidebarProps) {
  const { t } = useI18n();

  return (
    <aside class="w-56 h-full bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0 select-none">
      {/* Top Header / Back Button */}
      <div class="p-3 border-b border-sidebar-border space-y-2">
        <Show when={!props.isStandalone}>
          <button
            type="button"
            onClick={props.onBack}
            class="w-full h-8 px-2.5 rounded-lg flex items-center justify-between text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all group border border-transparent hover:border-sidebar-border active:scale-[0.98]"
            title="Return to previous workspace view (Esc)"
          >
            <div class="flex items-center space-x-2">
              <ArrowLeft size={14} class="text-primary group-hover:-translate-x-0.5 transition-transform" />
              <span>{t("settings.back_to_workspace")}</span>
            </div>
            <kbd class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">
              Esc
            </kbd>
          </button>
        </Show>

        {/* Quick Search */}
        <div class="relative">
          <Search size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={props.searchQuery}
            onInput={(e) => props.onSearchChange(e.currentTarget.value)}
            placeholder={t("settings.search_placeholder")}
            class="w-full h-8 pl-8 pr-7 text-xs bg-background/80 border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          <Show when={props.searchQuery}>
            <button
              type="button"
              onClick={() => props.onSearchChange("")}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          </Show>
        </div>
      </div>

      {/* Categories Navigation */}
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <For each={SETTINGS_CATEGORIES}>
          {(cat) => {
            const Icon = cat.icon;
            const isSelected = () => props.activeCategory === cat.id;

            return (
              <button
                type="button"
                onClick={() => props.onSelectCategory(cat.id)}
                class={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isSelected()
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon
                  size={15}
                  class={`flex-shrink-0 ${
                    isSelected() ? "text-primary-foreground" : "text-primary"
                  }`}
                />
                <span class="truncate">{t(cat.labelKey as any)}</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Bottom Detached Window Action */}
      <Show when={!props.isStandalone && props.onOpenStandalone}>
        <div class="p-2.5 border-t border-sidebar-border flex-shrink-0">
          <button
            type="button"
            onClick={props.onOpenStandalone}
            class="w-full h-8 px-2.5 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 transition-all active:scale-[0.98]"
            title={t("settings.open_standalone")}
          >
            <ExternalLink size={13} class="text-primary" />
            <span class="truncate">{t("settings.open_standalone")}</span>
          </button>
        </div>
      </Show>
    </aside>
  );
}
