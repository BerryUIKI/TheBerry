import { useApp, ViewType } from "../../context/AppContext";
import { useI18n, TranslationKey } from "../../context/I18nContext";
import {
  ClipboardList,
  Code2,
  Rocket,
  Image as ImageIcon,
  Search,
  Settings,
  FolderDot,
} from "lucide-solid";

interface NavItemDef {
  id: ViewType;
  key: TranslationKey;
  icon: typeof ClipboardList;
}

const navDefs: NavItemDef[] = [
  { id: "clipboard", key: "nav.clipboard", icon: ClipboardList },
  { id: "snippets", key: "nav.snippets", icon: Code2 },
  { id: "launcher", key: "nav.launcher", icon: Rocket },
  { id: "image_converter", key: "nav.image_converter", icon: ImageIcon },
  { id: "file_search", key: "nav.file_search", icon: Search },
];

export function Sidebar() {
  const { activeView, setActiveView, dataDir } = useApp();
  const { t } = useI18n();

  return (
    <aside class="w-56 h-full bg-sidebar border-r border-sidebar-border flex flex-col justify-between select-none flex-shrink-0">
      <div class="flex flex-col p-2 space-y-1">
        <div class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Utilities Suite
        </div>

        {navDefs.map((item) => {
          const isActive = activeView() === item.id;
          const Icon = item.icon;
          return (
            <button
              onClick={() => setActiveView(item.id)}
              class={`flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon size={16} class={isActive ? "text-primary-foreground" : "text-muted-foreground"} />
              <span class="truncate">{t(item.key)}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom info & Settings */}
      <div class="p-2 border-t border-sidebar-border space-y-1">
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
          <Settings size={16} class={activeView() === "settings" ? "text-primary-foreground" : "text-muted-foreground"} />
          <span>{t("nav.settings")}</span>
        </button>
      </div>
    </aside>
  );
}
