import { Show } from "solid-js";
import { AppConfig } from "../../../types/config";
import { AIConfig } from "../../../types/goose";
import { useI18n } from "../../../context/I18nContext";
import { useTheme } from "../../../context/ThemeContext";
import { useToast } from "../../../context/ToastContext";
import { saveAIConfig } from "../../../services/goose";
import { Moon, Sun, ShieldCheck, Languages, Check } from "lucide-solid";

interface GeneralSectionProps {
  config: () => AppConfig;
  handleSave: (updated: Partial<AppConfig>) => Promise<void>;
  autostartActive: () => boolean;
  handleToggleAutostart: (checked: boolean) => Promise<void>;
  aiConfig: () => AIConfig | null;
}

export function GeneralSection(props: GeneralSectionProps) {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { success } = useToast();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <ShieldCheck size={16} class="text-primary" />
          <span>{t("settings.general")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Global Interface Language Selector */}
      <div class="p-4 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <div class="flex items-center justify-between">
          <label class="font-semibold text-foreground text-xs flex items-center space-x-1.5">
            <Languages size={15} class="text-primary" />
            <span>{t("settings.language")}</span>
          </label>
          <span class="text-[11px] text-muted-foreground">{t("settings.language_desc")}</span>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={async () => {
              await setLanguage("en");
              if (props.aiConfig()) {
                await saveAIConfig({ ...props.aiConfig()!, language: "en" });
              }
              success(t("settings.saved_success"), "Interface language set to English (TheBerry AI)");
            }}
            class={`p-3 rounded-lg border text-left transition-all ${
              language() === "en"
                ? "bg-primary/10 border-primary text-foreground font-semibold shadow-xs"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <div class="flex items-center space-x-1.5">
              <span class="text-xs font-bold text-foreground">English</span>
              <Show when={language() === "en"}>
                <Check size={13} class="text-primary ml-auto" />
              </Show>
            </div>
            <p class="text-[10px] text-muted-foreground mt-0.5">Assistant name: TheBerry AI</p>
          </button>

          <button
            type="button"
            onClick={async () => {
              await setLanguage("zh");
              if (props.aiConfig()) {
                await saveAIConfig({ ...props.aiConfig()!, language: "zh" });
              }
              success(t("settings.saved_success"), "界面语言已切换为简体中文 (豆花 AI)");
            }}
            class={`p-3 rounded-lg border text-left transition-all ${
              language() === "zh"
                ? "bg-primary/10 border-primary text-foreground font-semibold shadow-xs"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <div class="flex items-center space-x-1.5">
              <span class="text-xs font-bold text-foreground">简体中文</span>
              <Show when={language() === "zh"}>
                <Check size={13} class="text-primary ml-auto" />
              </Show>
            </div>
            <p class="text-[10px] text-muted-foreground mt-0.5">助手名称: 豆花 AI</p>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Theme Appearance */}
        <div class="p-4 bg-card border border-border rounded-xl space-y-3 shadow-xs">
          <label class="font-semibold text-foreground text-xs block">{t("settings.theme")}</label>
          <div class="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                setTheme("dark");
                props.handleSave({ theme: "dark" });
              }}
              class={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-xs border transition-all ${
                theme() === "dark"
                  ? "bg-primary/10 border-primary text-foreground font-semibold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon size={14} />
              <span>{t("settings.theme_dark")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme("light");
                props.handleSave({ theme: "light" });
              }}
              class={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-xs border transition-all ${
                theme() === "light"
                  ? "bg-primary/10 border-primary text-foreground font-semibold"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun size={14} />
              <span>{t("settings.theme_light")}</span>
            </button>
          </div>
        </div>

        {/* System Startup & Tray Behavior */}
        <div class="p-4 bg-card border border-border rounded-xl space-y-3 shadow-xs text-xs">
          <label class="font-semibold text-foreground block">{t("settings.system_startup")}</label>
          <div class="space-y-2.5">
            <label class="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={props.autostartActive()}
                onChange={(e) => props.handleToggleAutostart(e.currentTarget.checked)}
                class="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span class="text-muted-foreground text-xs leading-tight">
                {t("settings.autostart_desc")}
              </span>
            </label>

            <label class="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={props.config().close_to_tray}
                onChange={(e) => props.handleSave({ close_to_tray: e.currentTarget.checked })}
                class="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span class="text-muted-foreground text-xs leading-tight">
                {t("settings.close_to_tray_desc")}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
