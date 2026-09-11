import { describe, it, expect } from "vitest";

describe("Frontend Snippet Variable Engine", () => {
  const computeLivePreview = (text: string) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    const fakeUuid = "e4eaaaf2-d142-11e1-b3e4-080027620cdd";

    return text
      .replace(/\$\{CURRENT_DATE\}/g, dateStr)
      .replace(/\$\{DATE\}/g, dateStr)
      .replace(/\$\{CURRENT_TIME\}/g, timeStr)
      .replace(/\$\{TIME\}/g, timeStr)
      .replace(/\$\{CURRENT_DATETIME\}/g, `${dateStr} ${timeStr}`)
      .replace(/\$\{UUID\}/g, fakeUuid)
      .replace(/\$\{CLIPBOARD_TEXT\}/g, "[Clipboard Content]");
  };

  it("expands ${CURRENT_DATE} and ${UUID} template placeholders", () => {
    const template = "Created on ${CURRENT_DATE} with ID ${UUID}";
    const result = computeLivePreview(template);

    expect(result).not.toContain("${CURRENT_DATE}");
    expect(result).not.toContain("${UUID}");
    expect(result).toContain("Created on ");
    expect(result).toContain("with ID e4eaaaf2-d142-11e1-b3e4-080027620cdd");
  });

  it("expands clipboard placeholders", () => {
    const template = "const snippet = `${CLIPBOARD_TEXT}`;";
    const result = computeLivePreview(template);

    expect(result).toBe("const snippet = `[Clipboard Content]`;");
  });
});
