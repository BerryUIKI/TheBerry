import { Show, For } from "solid-js";
import { Keyboard, X } from "lucide-solid";
import { useI18n } from "../context/I18nContext";

export function ShortcutsModal(props: { isOpen: boolean; onClose: () => void }) {
  const { t, assistantName } = useI18n();

  const shortcutSections = () => [
    {
      title: t("shortcuts.sec_global"),
      items: [
        { keys: ["Ctrl", "K"], description: t("shortcuts.global_spotlight") },
        { keys: ["Ctrl", "J"], description: t("shortcuts.global_assistant") },
        { keys: ["?"], description: t("shortcuts.global_cheatsheet") },
        { keys: ["Esc"], description: t("shortcuts.global_close") },
      ],
    },
    {
      title: t("shortcuts.sec_spotlight"),
      items: [
        { keys: ["@app"], description: t("shortcuts.spot_filter_app") },
        { keys: ["@clip"], description: t("shortcuts.spot_filter_clip") },
        { keys: ["@snip"], description: t("shortcuts.spot_filter_snip") },
        { keys: ["@file"], description: t("shortcuts.spot_filter_file") },
        { keys: ["↑", "↓"], description: t("shortcuts.spot_navigate") },
        { keys: ["Enter"], description: t("shortcuts.spot_action") },
        { keys: ["Shift", "Space"], description: t("shortcuts.spot_quicklook") },
        { keys: ["Ctrl", "C"], description: t("shortcuts.spot_copy") },
        { keys: ["Ctrl", "E"], description: t("shortcuts.spot_reveal") },
      ],
    },
    {
      title: t("shortcuts.sec_file_clip"),
      items: [
        { keys: ["Space"], description: t("shortcuts.fc_quicklook") },
        { keys: ["Ctrl", "Shift", "C"], description: t("shortcuts.fc_copy_snippet") },
        { keys: ["Click Thumb"], description: t("shortcuts.fc_zoom_image") },
      ],
    },
  ];

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="w-full max-w-lg bg-card/95 border border-border rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div class="flex items-center space-x-2.5">
              <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Keyboard size={18} />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-foreground">{t("shortcuts.modal_title")}</h3>
                <p class="text-[11px] text-muted-foreground">{t("shortcuts.modal_subtitle")}</p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div class="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            <For each={shortcutSections()}>
              {(section) => (
                <div>
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                    {section.title}
                  </h4>
                  <div class="space-y-2">
                    <For each={section.items}>
                      {(item) => (
                        <div class="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-secondary/40 transition-colors">
                          <span class="text-xs text-foreground/90">{item.description}</span>
                          <div class="flex items-center space-x-1">
                            <For each={item.keys}>
                              {(k) => (
                                <kbd class="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-muted border border-border/80 text-foreground shadow-xs">
                                  {k}
                                </kbd>
                              )}
                            </For>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Footer */}
          <div class="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t("shortcuts.footer_esc")}</span>
            <span class="text-primary font-medium">{assistantName()} Productivity Suite</span>
          </div>
        </div>
      </div>
    </Show>
  );
}

