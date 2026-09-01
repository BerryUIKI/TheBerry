# ADR-0012: Markdown Rendering Engine for Agents Conversation Interface

## Context
TheBerry AI Assistant (TheBerry / 豆花) streams responses that frequently contain rich formatted content, including:
- Multi-language code blocks with syntax styling and one-click copy buttons
- Headings (`#`, `##`, `###`), bold text (`**...**`), italics, and inline code (`` `code` ``)
- Numbered and bulleted lists
- Markdown tables
- Blockquotes and hyperlinks

Previously, assistant messages were rendered as raw plain text with line break preserving (`whitespace-pre-wrap`), resulting in unrendered Markdown syntax tags.

## Decisions

### 1. Markdown Engine Selection
We integrate `marked` as the fast, compliant GitHub Flavored Markdown (GFM) parser:
- GFM enabled (`gfm: true`, `breaks: true`).
- HTML sanitization / escaping to protect against XSS injections while maintaining formatted outputs.

### 2. Custom Markdown Component (`MarkdownContent.tsx`)
Create `src/components/common/MarkdownContent.tsx`:
- Parses raw markdown into sanitized HTML safely.
- Styles headings, lists, blockquotes, inline code, tables, and paragraphs cleanly matching TheBerry's dark/light themes.
- Renders code blocks with a dedicated header bar displaying language tag and a one-click **Copy Code** button.
- Intercepts external links to open securely via `@tauri-apps/plugin-opener` or browser windows.

### 3. Integration in `GooseSidebar.tsx`
- Replaces raw `whitespace-pre-wrap` text display with `<MarkdownContent content={msg.content} isStreaming={msg.isStreaming} />`.

## Consequences
- **Positive**:
  - Full GitHub-Flavored Markdown support in AI chats.
  - Interactive code blocks with copy buttons and language badges.
  - Zero performance degradation during real-time streaming chunks.
