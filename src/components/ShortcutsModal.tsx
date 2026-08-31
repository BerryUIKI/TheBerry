import { Show, For } from "solid-js";
import { Keyboard, X, Command } from "lucide-solid";

interface ShortcutSection {
  title: string;
  items: { keys: string[]; description: string }[];
}

const shortcutSections: ShortcutSection[] = [
  {
    title: "Global & Navigation",
    items: [
      { keys: ["Ctrl", "K"], description: "Toggle Spotlight HUD search" },
      { keys: ["?"], description: "Toggle keyboard shortcuts cheat-sheet" },
      { keys: ["Esc"], description: "Close active modal / Spotlight" },
    ],
  },
  {
    title: "Spotlight HUD",
    items: [
      { keys: ["@app"], description: "Filter only applications" },
      { keys: ["@clip"], description: "Filter only clipboard items" },
      { keys: ["@snip"], description: "Filter only snippets" },
      { keys: ["@file"], description: "Filter only file search" },
      { keys: ["↑", "↓"], description: "Navigate search results" },
      { keys: ["Enter"], description: "Launch app / Copy snippet / Open file" },
      { keys: ["Ctrl", "C"], description: "Copy item path / content" },
      { keys: ["Ctrl", "E"], description: "Reveal file/app in Explorer" },
    ],
  },
  {
    title: "Clipboard & Snippets",
    items: [
      { keys: ["Ctrl", "Shift", "C"], description: "Quick copy expanded snippet" },
      { keys: ["Click Thumb"], description: "Zoom full image modal" },
    ],
  },
];

export function ShortcutsModal(props: { isOpen: boolean; onClose: () => void }) {
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
                <h3 class="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
                <p class="text-[11px] text-muted-foreground">Power-user keyboard navigation guide</p>
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
            <For each={shortcutSections}>
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
            <span>Press <kbd class="px-1.5 py-0.5 rounded bg-muted font-mono">Esc</kbd> to close</span>
            <span class="text-primary font-medium">TheBerry Productivity Suite</span>
          </div>
        </div>
      </div>
    </Show>
  );
}
