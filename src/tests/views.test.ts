import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClipboardItem } from "../types/clipboard";
import { LauncherItem } from "../types/launcher";
import { SearchResultItem } from "../types/fileSearch";
import { ConvertTask, ConvertResult } from "../types/imageConverter";
import { AppConfig } from "../types/config";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  getClipboardHistory,
  searchClipboardHistory,
  toggleClipboardPin,
  deleteClipboardItem,
  clearClipboardHistory,
  copyToSystemClipboard,
} from "../services/clipboard";
import {
  getLauncherItems,
  saveLauncherItem,
  deleteLauncherItem,
  launchItem,
  discoverSystemApps,
} from "../services/launcher";
import {
  getSystemDrives,
  searchFiles,
  revealInExplorer,
  openFilePath,
} from "../services/fileSearch";
import { convertImages } from "../services/imageConverter";
import { getConfig, updateConfig } from "../services/system";
import { exportFullBackup, importFullBackup } from "../services/backup";

describe("View Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ClipboardView Interaction Logic", () => {
    const mockItems: ClipboardItem[] = [
      {
        id: "clip-1",
        content_type: "text",
        content: "Git commit message",
        preview: "Git commit message",
        media_path: null,
        media_data_url: null,
        image_width: null,
        image_height: null,
        is_pinned: false,
        char_count: 18,
        created_at: "2026-09-02T10:00:00Z",
      },
      {
        id: "clip-2",
        content_type: "text",
        content: "API_KEY=xyz123",
        preview: "API_KEY=xyz123",
        media_path: null,
        media_data_url: null,
        image_width: null,
        image_height: null,
        is_pinned: true,
        char_count: 14,
        created_at: "2026-09-02T10:05:00Z",
      },
      {
        id: "clip-3",
        content_type: "image",
        content: "[Image Data]",
        preview: "[Image Data]",
        media_path: "C:\\images\\screenshot.png",
        media_data_url: "data:image/png;base64,...",
        image_width: 800,
        image_height: 600,
        is_pinned: false,
        char_count: 12,
        created_at: "2026-09-02T10:10:00Z",
      },
    ];

    it("loads and displays full clipboard history", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockItems);
      const history = await getClipboardHistory();
      expect(history).toHaveLength(3);
      expect(invoke).toHaveBeenCalledWith("get_clipboard_history", undefined);
    });

    it("filters clipboard history by keyword and content type", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([mockItems[0]]);
      const results = await searchClipboardHistory("commit", "text", false);
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain("Git commit");
      expect(invoke).toHaveBeenCalledWith("search_clipboard_history", {
        query: "commit",
        contentType: "text",
        isPinned: false,
        limit: null,
      });
    });

    it("toggles pin status and moves pinned item to top", async () => {
      const updated = { ...mockItems[0], is_pinned: true };
      vi.mocked(invoke).mockResolvedValueOnce(updated);

      const res = await toggleClipboardPin("clip-1");
      expect(res.is_pinned).toBe(true);
      expect(invoke).toHaveBeenCalledWith("toggle_clipboard_pin", { id: "clip-1" });
    });

    it("copies text content to system clipboard", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await copyToSystemClipboard("Sample text to paste");
      expect(invoke).toHaveBeenCalledWith("copy_to_system_clipboard", {
        content: "Sample text to paste",
      });
    });

    it("deletes single clipboard item and clears unpinned items", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteClipboardItem("clip-1");
      expect(invoke).toHaveBeenCalledWith("delete_clipboard_item", { id: "clip-1" });

      vi.mocked(invoke).mockResolvedValueOnce(5);
      const count = await clearClipboardHistory();
      expect(count).toBe(5);
      expect(invoke).toHaveBeenCalledWith("clear_clipboard_history", undefined);
    });
  });

  describe("FileSearchView Interaction Logic", () => {
    const mockFiles: SearchResultItem[] = [
      {
        name: "index.tsx",
        path: "C:\\projects\\the-berry\\src\\index.tsx",
        is_dir: false,
        size_bytes: 4096,
        extension: "tsx",
        modified_time: 1772620000,
      },
      {
        name: "main.rs",
        path: "C:\\projects\\the-berry\\src-tauri\\src\\main.rs",
        is_dir: false,
        size_bytes: 1024,
        extension: "rs",
        modified_time: 1772621000,
      },
      {
        name: "assets",
        path: "C:\\projects\\the-berry\\assets",
        is_dir: true,
        size_bytes: 0,
        extension: "",
        modified_time: 1772619000,
      },
    ];

    it("fetches system drives and searches files", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { mount_point: "C:\\", name: "Local Disk (C:)", total_space_bytes: 512000000, available_space_bytes: 256000000 },
      ]);
      const drives = await getSystemDrives();
      expect(drives).toHaveLength(1);
      expect(drives[0].mount_point).toBe("C:\\");

      vi.mocked(invoke).mockResolvedValueOnce(mockFiles);
      const files = await searchFiles({
        pattern: "*.tsx",
        search_root: "C:\\projects",
        file_type_filter: "code",
      });
      expect(files).toHaveLength(3);
      expect(invoke).toHaveBeenCalledWith("search_files", {
        query: { pattern: "*.tsx", search_root: "C:\\projects", file_type_filter: "code" },
      });
    });

    it("reveals target path in Windows explorer", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await revealInExplorer("C:\\projects\\the-berry\\README.md");
      expect(invoke).toHaveBeenCalledWith("reveal_in_explorer", {
        path: "C:\\projects\\the-berry\\README.md",
      });
    });

    it("opens target file or executable", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await openFilePath("C:\\projects\\the-berry\\src\\index.tsx");
      expect(invoke).toHaveBeenCalledWith("open_file_path", {
        path: "C:\\projects\\the-berry\\src\\index.tsx",
      });
    });
  });

  describe("LauncherView Interaction Logic", () => {
    const mockApps: LauncherItem[] = [
      {
        id: "app-1",
        name: "Visual Studio Code",
        description: "Code editing redefined",
        exec_path: "C:\\Program Files\\VSCode\\Code.exe",
        arguments: ["."],
        icon_path: null,
        category: "Development",
        is_favorite: true,
        created_at: "2026-09-02T08:00:00Z",
      },
      {
        id: "app-2",
        name: "Google Chrome",
        description: "Web Browser",
        exec_path: "C:\\Program Files\\Google\\Chrome\\chrome.exe",
        arguments: [],
        icon_path: null,
        category: "Internet",
        is_favorite: false,
        created_at: "2026-09-02T08:05:00Z",
      },
    ];

    it("retrieves launcher items and filters by favorite", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockApps);
      const items = await getLauncherItems();
      expect(items).toHaveLength(2);
      const favorites = items.filter((i) => i.is_favorite);
      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe("Visual Studio Code");
    });

    it("launches an application with parameters", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await launchItem("app-1");
      expect(invoke).toHaveBeenCalledWith("launch_item", { id: "app-1" });
    });

    it("saves and deletes launcher items", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockApps[0]);
      const saved = await saveLauncherItem({
        name: "Visual Studio Code",
        exec_path: "C:\\Program Files\\VSCode\\Code.exe",
        category: "Development",
      });
      expect(saved.name).toBe("Visual Studio Code");

      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      await deleteLauncherItem("app-1");
      expect(invoke).toHaveBeenCalledWith("delete_launcher_item", { id: "app-1" });
    });

    it("discovers installed system applications", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockApps);
      const discovered = await discoverSystemApps();
      expect(discovered).toHaveLength(2);
      expect(invoke).toHaveBeenCalledWith("discover_system_apps", undefined);
    });
  });

  describe("ImageConverterView Interaction Logic", () => {
    it("converts image batch with format and quality specifications", async () => {
      const task: ConvertTask = {
        source_path: "C:\\images\\photo.png",
        target_format: "webp",
        quality: 85,
        output_dir: "C:\\images\\optimized",
        resize_width: 1920,
        resize_height: 1080,
        preserve_aspect_ratio: true,
      };

      const mockResult: ConvertResult = {
        source_path: "C:\\images\\photo.png",
        target_path: "C:\\images\\optimized\\photo_converted.webp",
        original_size_bytes: 2048000,
        converted_size_bytes: 450000,
        success: true,
        error_message: null,
        width: 1920,
        height: 1080,
      };

      vi.mocked(invoke).mockResolvedValueOnce([mockResult]);
      const results = await convertImages([task]);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].converted_size_bytes).toBeLessThan(results[0].original_size_bytes);
      expect(invoke).toHaveBeenCalledWith("convert_images", { tasks: [task] });
    });
  });

  describe("SettingsView Interaction Logic", () => {
    const mockConfig: AppConfig = {
      version: "0.1.4",
      theme: "dark",
      language: "en",
      close_to_tray: true,
      launch_at_startup: true,
      global_shortcuts_enabled: true,
      hud_shortcut: "Alt+Space",
      quicklook_enabled: true,
      clipboard_history_limit: 200,
      custom_data_dir: "C:\\Users\\User\\.the-berry",
    };

    it("loads configuration successfully", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockConfig);
      const config = await getConfig();
      expect(config.theme).toBe("dark");
      expect(config.hud_shortcut).toBe("Alt+Space");
      expect(invoke).toHaveBeenCalledWith("get_config", undefined);
    });

    it("updates configuration preferences", async () => {
      const updatedConfig = { ...mockConfig, theme: "light" };
      vi.mocked(invoke).mockResolvedValueOnce(updatedConfig);

      const res = await updateConfig(updatedConfig);
      expect(res.theme).toBe("light");
      expect(invoke).toHaveBeenCalledWith("update_config", { config: updatedConfig });
    });

    it("exports and imports application backups", async () => {
      const backupJson = JSON.stringify({ version: "0.1.4", clipboard: [] });
      vi.mocked(invoke).mockResolvedValueOnce(backupJson);

      const exported = await exportFullBackup();
      expect(exported).toBe(backupJson);
      expect(invoke).toHaveBeenCalledWith("export_full_backup", undefined);

      const mockSummary = {
        clipboard_count: 10,
        snippets_count: 5,
        launcher_count: 2,
        created_at: "2026-09-02T10:00:00Z",
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockSummary);
      const summary = await importFullBackup(backupJson);
      expect(summary.clipboard_count).toBe(10);
      expect(invoke).toHaveBeenCalledWith("import_full_backup", { jsonContent: backupJson });
    });
  });
});
