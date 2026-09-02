import { createContext, useContext, createSignal, JSX } from "solid-js";
import { ToastItem, ToastType } from "../types/toast";

interface ToastContextValue {
  toasts: () => ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextValue>();

export function ToastProvider(props: { children: JSX.Element }) {
  const [toasts, setToasts] = createSignal<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (toast: Omit<ToastItem, "id">): string => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem: ToastItem = { ...toast, id };
    const duration = toast.durationMs ?? 3000;

    const MAX_CONCURRENT_TOASTS = 5;
    setToasts((prev) => {
      const updated = [...prev, newItem];
      if (updated.length > MAX_CONCURRENT_TOASTS) {
        return updated.slice(updated.length - MAX_CONCURRENT_TOASTS);
      }
      return updated;
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const success = (title: string, message?: string) =>
    addToast({ type: "success", title, message });

  const error = (title: string, message?: string) =>
    addToast({ type: "error", title, message, durationMs: 4500 });

  const info = (title: string, message?: string) =>
    addToast({ type: "info", title, message });

  const warning = (title: string, message?: string) =>
    addToast({ type: "warning", title, message, durationMs: 4000 });

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        success,
        error,
        info,
        warning,
      }}
    >
      {props.children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
