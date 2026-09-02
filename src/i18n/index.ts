import { en } from "./en";
import { zh } from "./zh";

export const TRANSLATIONS = {
  en,
  zh,
} as const;

export type AppLanguage = "en" | "zh";
export type TranslationKey = keyof typeof en;
