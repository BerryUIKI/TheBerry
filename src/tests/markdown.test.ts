import { describe, it, expect } from "vitest";
import { marked } from "marked";

describe("Markdown Rendering Tests", () => {
  it("renders GitHub Flavored Markdown headings, bold, and lists", () => {
    const raw = `# Heading 1\n**Bold Text**\n- Item 1\n- Item 2`;
    const parsed = marked.parse(raw, { async: false }) as string;
    expect(parsed).toContain("<h1>Heading 1</h1>");
    expect(parsed).toContain("<strong>Bold Text</strong>");
    expect(parsed).toContain("<li>Item 1</li>");
    expect(parsed).toContain("<li>Item 2</li>");
  });

  it("renders fenced code blocks with language tag", () => {
    const raw = "```typescript\nconst greeting: string = 'Hello World';\n```";
    const parsed = marked.parse(raw, { async: false }) as string;
    expect(parsed).toContain('<code class="language-typescript">');
    expect(parsed).toContain("const greeting: string = &#39;Hello World&#39;;");
  });

  it("renders markdown tables", () => {
    const raw = `| Column 1 | Column 2 |\n|---|---|\n| Value 1 | Value 2 |`;
    const parsed = marked.parse(raw, { async: false }) as string;
    expect(parsed).toContain("<table>");
    expect(parsed).toContain("<th>Column 1</th>");
    expect(parsed).toContain("<td>Value 1</td>");
  });
});
