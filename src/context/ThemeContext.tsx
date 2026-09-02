import { createContext, createSignal, JSX, useContext, onMount, createEffect, onCleanup } from "solid-js";
import { emit, listen } from "@tauri-apps/api/event";
import { safeInvoke } from "../services/tauri";
import { AppConfig } from "../types/config";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: () => Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>();

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeState] = createSignal<Theme>("dark");

  const applyThemeToDOM = (t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  onMount(async () => {
    // 1. Check AppConfig or localStorage
    try {
      const cfg = await safeInvoke<AppConfig>("get_config");
      if (cfg && (cfg.theme === "dark" || cfg.theme === "light")) {
        setThemeState(cfg.theme);
        applyThemeToDOM(cfg.theme);
      } else {
        const saved = localStorage.getItem("berry_theme") as Theme | null;
        if (saved === "light" || saved === "dark") {
          setThemeState(saved);
          applyThemeToDOM(saved);
        } else {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          const initial = prefersDark ? "dark" : "light";
          setThemeState(initial);
          applyThemeToDOM(initial);
        }
      }
    } catch {
      const saved = localStorage.getItem("berry_theme") as Theme | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
        applyThemeToDOM(saved);
      }
    }

    // 2. Listen for cross-window theme change events from any window
    let unlisten: (() => void) | null = null;
    listen<{ theme: Theme }>("theme-changed", (event) => {
      if (event.payload?.theme) {
        setThemeState(event.payload.theme);
        applyThemeToDOM(event.payload.theme);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "berry_theme" && (e.newValue === "dark" || e.newValue === "light")) {
        setThemeState(e.newValue);
        applyThemeToDOM(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);

    onCleanup(() => {
      if (unlisten) unlisten();
      window.removeEventListener("storage", handleStorage);
    });
  });

  createEffect(() => {
    const current = theme();
    applyThemeToDOM(current);
    localStorage.setItem("berry_theme", current);
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyThemeToDOM(t);
    localStorage.setItem("berry_theme", t);
    emit("theme-changed", { theme: t }).catch(() => {});
  };

  const toggleTheme = () => {
    const next = theme() === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
