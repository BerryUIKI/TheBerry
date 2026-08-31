import { For, Show } from "solid-js";
import { useToast } from "../context/ToastContext";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-solid";
import { ToastItem } from "../types/toast";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  const getIcon = (type: ToastItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={18} class="text-emerald-500 flex-shrink-0" />;
      case "error":
        return <AlertCircle size={18} class="text-rose-500 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle size={18} class="text-amber-500 flex-shrink-0" />;
      case "info":
      default:
        return <Info size={18} class="text-sky-500 flex-shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastItem["type"]) => {
    switch (type) {
      case "success":
        return "border-emerald-500/30 bg-card/95";
      case "error":
        return "border-rose-500/30 bg-card/95";
      case "warning":
        return "border-amber-500/30 bg-card/95";
      case "info":
      default:
        return "border-sky-500/30 bg-card/95";
    }
  };

  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 fade-in duration-200 ${getBorderColor(
              toast.type
            )}`}
          >
            <div class="pt-0.5">{getIcon(toast.type)}</div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-semibold text-foreground tracking-tight">
                {toast.title}
              </div>
              <Show when={toast.message}>
                <div class="text-[11px] text-muted-foreground mt-0.5 break-words line-clamp-3">
                  {toast.message}
                </div>
              </Show>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              class="text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-secondary transition-colors"
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
