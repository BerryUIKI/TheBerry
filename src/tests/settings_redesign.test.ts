// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SETTINGS_CATEGORIES } from "../components/settings/SettingsSidebar";
import { openSettingsWindow } from "../services/system";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("Settings Redesign & Modularity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all 7 focused settings categories", () => {
    const ids = SETTINGS_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual([
      "general",
      "shortcuts",
      "quicklook",
      "ai",
      "clipboard",
      "storage",
      "about",
    ]);
  });

  it("each category has valid keywords for quick filtering", () => {
    for (const cat of SETTINGS_CATEGORIES) {
      expect(cat.keywords.length).toBeGreaterThan(2);
      expect(typeof cat.labelKey).toBe("string");
      expect(cat.icon).toBeDefined();
    }
  });

  it("calls open_settings_window IPC on standalone window request", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await openSettingsWindow();
    expect(invoke).toHaveBeenCalledWith("open_settings_window", undefined);
  });
});
