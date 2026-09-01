import { describe, it, expect } from "vitest";
import { ClipboardItem } from "../types/clipboard";
import { SnippetItem } from "../types/snippets";
import { LauncherItem } from "../types/launcher";
import { ConvertTask } from "../types/imageConverter";
import { SearchQuery } from "../types/fileSearch";

describe("Frontend Type Model Contracts", () => {
  it("validates ClipboardItem schema structure", () => {
    const item: ClipboardItem = {
      id: "uuid-1234",
      content_type: "text",
      content: "const a = 1;",
      preview: "const a = 1;",
      is_pinned: false,
      char_count: 12,
      created_at: new Date().toISOString(),
    };

    expect(item.id).toBe("uuid-1234");
    expect(item.char_count).toBe(12);
    expect(item.is_pinned).toBe(false);
  });

  it("validates SnippetItem schema structure", () => {
    const snippet: SnippetItem = {
      id: "snip-1",
      title: "Quick Sort",
      description: "Fast sorting algorithm",
      content: "function quickSort() {}",
      language: "typescript",
      category: "Algorithms",
      tags: ["sort", "ts"],
      is_favorite: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(snippet.title).toBe("Quick Sort");
    expect(snippet.tags).toHaveLength(2);
    expect(snippet.is_favorite).toBe(true);
  });

  it("validates LauncherItem schema structure", () => {
    const launcher: LauncherItem = {
      id: "launch-1",
      name: "Terminal",
      description: "Open powershell",
      exec_path: "pwsh.exe",
      arguments: ["-NoLogo"],
      category: "Tools",
      is_favorite: false,
      launch_count: 5,
      is_batch: false,
      batch_commands: [],
      created_at: new Date().toISOString(),
    };

    expect(launcher.launch_count).toBe(5);
    expect(launcher.arguments).toContain("-NoLogo");
  });

  it("validates Image ConvertTask structure", () => {
    const task: ConvertTask = {
      source_path: "C:\\img.png",
      target_format: "webp",
      quality: 85,
      output_dir: "C:\\out",
    };

    expect(task.target_format).toBe("webp");
    expect(task.quality).toBe(85);
  });

  it("validates SearchQuery structure", () => {
    const query: SearchQuery = {
      pattern: "report.pdf",
      search_root: "D:\\",
      max_results: 100,
      file_type_filter: "doc",
      case_sensitive: false,
    };

    expect(query.file_type_filter).toBe("doc");
    expect(query.max_results).toBe(100);
  });

  it("validates AppConfig structure with language preferences", () => {
    const config: import("../types/config").AppConfig = {
      version: "0.1.3",
      theme: "dark",
      language: "en",
      close_to_tray: true,
      autostart: false,
      clipboard_history_limit: 200,
      custom_data_dir: "C:\\data",
    };

    expect(config.language).toBe("en");
    expect(config.theme).toBe("dark");
  });
});
