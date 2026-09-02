import { createContext, createSignal, JSX, useContext, onMount, createEffect } from "solid-js";
import { getConfig, updateConfig } from "../services/system";

import { TRANSLATIONS, AppLanguage, TranslationKey } from "../i18n";
export type { AppLanguage, TranslationKey };

interface I18nContextType {
  language: () => AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  assistantName: () => string;
}

const I18nContext = createContext<I18nContextType>();

export function I18nProvider(props: { children: JSX.Element }) {
  const [language, setLanguageState] = createSignal<AppLanguage>("en");

  onMount(async () => {
    // 1. Check localStorage first
    const saved = localStorage.getItem("berry_language") as AppLanguage | null;
    if (saved === "en" || saved === "zh") {
      setLanguageState(saved);
    }
    // 2. Sync from backend config
    try {
      const cfg = await getConfig();
      if (cfg?.language === "en" || cfg?.language === "zh") {
        setLanguageState(cfg.language);
        localStorage.setItem("berry_language", cfg.language);
      }
    } catch (e) {
      console.warn("Failed to load language from backend config:", e);
    }
  });

  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem("berry_language", lang);
    try {
      await updateConfig({ language: lang });
    } catch (e) {
      console.error("Failed to persist language to backend config:", e);
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    const lang = language();
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    let text = (dict as any)[key] || (TRANSLATIONS.en as any)[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
    }
    return text;
  };

  const assistantName = () => (language() === "zh" ? "豆花" : "TheBerry");

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, assistantName }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
