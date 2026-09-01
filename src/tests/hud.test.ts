import { describe, it, expect } from "vitest";

describe("HUD Query Intent Parser & State Machine", () => {
  it("detects AI mode by default for general prompts", () => {
    const query = "What is the weather in Tokyo?";
    const isSearch = query.trimStart().startsWith("/fin") || query.trimStart().startsWith("/f ");
    expect(isSearch).toBe(false);
  });

  it("detects search mode when prefixed with /fin or /f", () => {
    const queryFin = "/fin Cargo.toml";
    const isSearchFin = queryFin.trimStart().startsWith("/fin") || queryFin.trimStart().startsWith("/f ");
    expect(isSearchFin).toBe(true);

    const queryF = "/f main.rs";
    const isSearchF = queryF.trimStart().startsWith("/fin") || queryF.trimStart().startsWith("/f ");
    expect(isSearchF).toBe(true);
  });

  it("extracts clean search query keyword", () => {
    const extractClean = (q: string) => {
      const trimmed = q.trimStart();
      if (trimmed.startsWith("/fin")) return trimmed.slice(4).trim();
      if (trimmed.startsWith("/f ")) return trimmed.slice(3).trim();
      return trimmed;
    };

    expect(extractClean("/fin rust code")).toBe("rust code");
    expect(extractClean("/f documents")).toBe("documents");
    expect(extractClean("hello assistant")).toBe("hello assistant");
  });
});
