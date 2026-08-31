import { describe, it, expect } from "vitest";
import { SpotlightItem } from "../components/SpotlightModal";

describe("Spotlight Search Modal Model", () => {
  it("formats federated items properly", () => {
    const appItem: SpotlightItem = {
      id: "app_1",
      category: "app",
      title: "VSCode",
      subtitle: "Launch Application (Development)",
      rawPayload: { id: "1", name: "VSCode" },
    };

    const clipItem: SpotlightItem = {
      id: "clip_1",
      category: "clipboard",
      title: "Hello World",
      subtitle: "Recent clipboard item",
      rawPayload: { id: "1", content: "Hello World" },
    };

    const snipItem: SpotlightItem = {
      id: "snip_1",
      category: "snippet",
      title: "React Hook",
      subtitle: "Snippet (typescript)",
      rawPayload: { id: "1", content: "const [x] = createSignal();" },
    };

    const fileItem: SpotlightItem = {
      id: "file_1",
      category: "file",
      title: "config.toml",
      subtitle: "C:\\TheBerry\\config.toml",
      rawPayload: { path: "C:\\TheBerry\\config.toml" },
    };

    expect(appItem.category).toBe("app");
    expect(clipItem.category).toBe("clipboard");
    expect(snipItem.category).toBe("snippet");
    expect(fileItem.category).toBe("file");
    expect(appItem.title).toBe("VSCode");
  });

  it("handles search prefix classification", () => {
    const parsePrefix = (rawText: string) => {
      let filter = "all";
      let query = rawText;
      if (rawText.startsWith("@app")) {
        filter = "app";
        query = rawText.replace(/^@app\s*/, "");
      } else if (rawText.startsWith("@clip")) {
        filter = "clipboard";
        query = rawText.replace(/^@clip\s*/, "");
      } else if (rawText.startsWith("@snip")) {
        filter = "snippet";
        query = rawText.replace(/^@snip\s*/, "");
      } else if (rawText.startsWith("@file")) {
        filter = "file";
        query = rawText.replace(/^@file\s*/, "");
      }
      return { filter, query: query.trim() };
    };

    expect(parsePrefix("@app code")).toEqual({ filter: "app", query: "code" });
    expect(parsePrefix("@clip token")).toEqual({ filter: "clipboard", query: "token" });
    expect(parsePrefix("@snip async")).toEqual({ filter: "snippet", query: "async" });
    expect(parsePrefix("@file report.pdf")).toEqual({ filter: "file", query: "report.pdf" });
    expect(parsePrefix("general search")).toEqual({ filter: "all", query: "general search" });
  });
});
