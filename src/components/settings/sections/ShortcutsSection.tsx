import { AppConfig } from "../../../types/config";
import { useI18n } from "../../../context/I18nContext";
import { useToast } from "../../../context/ToastContext";
import { HotkeyRecorder } from "../HotkeyRecorder";
import { setGlobalShortcutsEnabled, setHudShortcut } from "../../../services/shortcuts";
import { Keyboard } from "lucide-solid";

interface ShortcutsSectionProps {
  config: () => AppConfig;
  handleSave: (updated: Partial<AppConfig>) => Promise<void>;
}

export function ShortcutsSection(props: ShortcutsSectionProps) {
  const { t } = useI18n();
  const { success, info, error } = useToast();

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-sm font-bold text-foreground flex items-center space-x-2">
          <Keyboard size={16} class="text-primary" />
          <span>{t("settings.shortcuts_hud")}</span>
        </h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          {t("settings.shortcuts_hud_desc")}
        </p>
      </div>

      <div class="p-4 bg-card border border-border rounded-xl space-y-4 shadow-xs">
        {/* Master Switch */}
        <div class="flex items-center justify-between">
          <div class="space-y-0.5 pr-4">
            <span class="text-xs font-semibold text-foreground block">
              {t("settings.enable_global_shortcuts")}
            </span>
            <span class="text-[11px] text-muted-foreground block">
              {t("settings.enable_global_shortcuts_desc")}
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              const nextVal = !props.config().global_shortcuts_enabled;
              try {
                await setGlobalShortcutsEnabled(nextVal);
                await props.handleSave({ global_shortcuts_enabled: nextVal });
                info(
                  nextVal ? "Global Shortcuts Enabled" : "Global Shortcuts Disabled",
                  nextVal ? "Press Alt+Space to open Quick Access HUD" : "Global hotkeys unregistered"
                );
              } catch (err: any) {
                error("Shortcut Registration Failed", err?.message || String(err));
              }
            }}
            class={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
              props.config().global_shortcuts_enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <div
              class={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                props.config().global_shortcuts_enabled ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* HUD Hotkey Configuration */}
        <div class="pt-3 border-t border-border flex items-center justify-between">
          <div class="space-y-0.5">
            <span class="text-xs font-semibold text-foreground block">
              {t("settings.hud_shortcut_key")}
            </span>
            <span class="text-[11px] text-muted-foreground block">
              Summon the minimalist Quick Access HUD overlay anywhere
            </span>
          </div>

          <HotkeyRecorder
            currentShortcut={props.config().hud_shortcut || "Alt+Space"}
            defaultShortcut="Alt+Space"
            onSave={async (newShortcut) => {
              await setHudShortcut(newShortcut);
              await props.handleSave({ hud_shortcut: newShortcut });
              success("Shortcut Updated", `HUD shortcut set to ${newShortcut}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
