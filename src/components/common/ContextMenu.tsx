import { onMount, onCleanup, Show, For } from "solid-js";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: any;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

export function ContextMenu(props: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  isOpen: boolean;
  onClose: () => void;
}) {
  let menuRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleClickOutside);

    onCleanup(() => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleClickOutside);
    });
  });

  // Keep within screen viewport bounds
  const getStyle = () => {
    const margin = 10;
    const estimatedWidth = 190;
    const estimatedHeight = props.items.length * 36;

    let left = props.x;
    let top = props.y;

    if (typeof window !== "undefined") {
      if (left + estimatedWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - estimatedWidth - margin);
      }
      if (top + estimatedHeight > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - estimatedHeight - margin);
      }
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  return (
    <Show when={props.isOpen}>
      <div
        ref={menuRef}
        style={getStyle()}
        class="fixed z-[999] min-w-[180px] bg-popover/95 text-popover-foreground border border-border rounded-xl shadow-2xl backdrop-blur-xl p-1.5 animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <For each={props.items}>
          {(item) => {
            if (item.divider) {
              return <div class="my-1 border-t border-border/60" />;
            }
            const Icon = item.icon;
            return (
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    props.onClose();
                  }
                }}
                class={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors font-medium ${
                  item.danger
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                } ${item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {Icon && (
                  <Icon
                    size={14}
                    class={item.danger ? "text-destructive" : "text-muted-foreground"}
                  />
                )}
                <span class="truncate">{item.label}</span>
              </button>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
