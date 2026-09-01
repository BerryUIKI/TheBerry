# ADR-0011: Global i18n Architecture, Reactive Translation System & Bilingual Assistant Identity

## Context
TheBerry is a comprehensive desktop utility suite designed for both international (English) and Chinese users.
Users require a global application-level language preference (`AppConfig.language: "en" | "zh"`) rather than localized agent-only flags:
1. When English is selected (`language = "en"`):
   - The entire user interface (Navigation, TitleBar, Spotlight HUD, Settings, Modules, Drawers, Modals) is strictly in English.
   - The AI Assistant is named **TheBerry**.
2. When Chinese is selected (`language = "zh"`):
   - The entire user interface is in simplified Chinese (简体中文).
   - The AI Assistant is named **豆花** (Douhua).

## Decisions

### 1. Global Language Schema in `AppConfig`
In `src-tauri/src/core/config.rs` and `src/types/config.ts`:
- Add `language: "en" | "zh"` to `AppConfig` (defaults to `"en"`).
- Persisted in local `config.toml` via `get_config` and `update_config` Tauri IPC commands.

### 2. Frontend Reactive `I18nContext`
In `src/context/I18nContext.tsx`:
- Provides `language: () => "en" | "zh"`, `setLanguage(lang: "en" | "zh")`, and `t(key: TranslationKey, params?: Record<string, string>) => string`.
- Synchronizes with `AppConfig` and local browser storage.
- Dispatches language changes reactively across all SolidJS components without reloading the webview.

### 3. Global Language Switcher in Settings
In `src/views/SettingsView.tsx`:
- Provides a dedicated **Language / 界面语言** configuration section with direct English and 简体中文 selectors.
- Updates `AppConfig.language` and `AIConfig.language` synchronously.

### 4. Dynamic Assistant Identity
- If `language === "zh"`: Assistant name is strictly **豆花**, system prompt sets Chinese desktop assistant persona.
- If `language === "en"`: Assistant name is strictly **TheBerry**, system prompt sets English desktop assistant persona.

## Consequences
- **Positive**:
  - Full application-wide i18n consistency.
  - Zero accidental mixed language strings.
  - Seamless toggle in Settings with instantaneous UI update.
