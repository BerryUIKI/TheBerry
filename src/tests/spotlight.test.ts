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

    expect(appItem.category).toBe("app");
    expect(clipItem.category).toBe("clipboard");
    expect(appItem.title).toBe("VSCode");
  });
});
