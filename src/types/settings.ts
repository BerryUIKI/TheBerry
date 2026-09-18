export type SettingsCategory =
  | "general"
  | "shortcuts"
  | "quicklook"
  | "ai"
  | "clipboard"
  | "storage"
  | "about";

export interface SettingsCategoryItem {
  id: SettingsCategory;
  labelKey: string;
  keywords: string[];
}
