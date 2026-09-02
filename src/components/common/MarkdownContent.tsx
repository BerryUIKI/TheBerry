import { createMemo } from "solid-js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MarkdownContentProps {
  content: string;
  class?: string;
}

// Configure marked with GitHub flavored markdown and line break support
marked.setOptions({
  gfm: true,
  breaks: true,
});

export function MarkdownContent(props: MarkdownContentProps) {
  let containerRef: HTMLDivElement | undefined;

  const htmlContent = createMemo(() => {
    if (!props.content) return "";
    try {
      const rawHtml = marked.parse(props.content, { async: false }) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      console.error("Markdown parsing error:", e);
      return DOMPurify.sanitize(props.content);
    }
  });

  const handleClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // 1. Handle Code Copy Button Click
    const copyBtn = target.closest(".markdown-copy-btn") as HTMLButtonElement | null;
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const codeBlock = copyBtn.closest(".markdown-code-wrapper")?.querySelector("code");
      if (codeBlock) {
        const textToCopy = codeBlock.innerText || codeBlock.textContent || "";
        try {
          await navigator.clipboard.writeText(textToCopy);
          const originalHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-emerald-500 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-emerald-500 font-semibold">Copied!</span>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
          }, 2000);
        } catch (err) {
          console.warn("Failed to copy code block:", err);
        }
      }
      return;
    }

    // 2. Handle External Link Click
    const link = target.closest("a") as HTMLAnchorElement | null;
    if (link && link.href) {
      e.preventDefault();
      e.stopPropagation();
      const href = link.getAttribute("href") || link.href;
      try {
        await openUrl(href);
      } catch {
        window.open(href, "_blank");
      }
    }
  };

  // Enhance rendered code blocks by wrapping them with language badges and copy button
  const enhancedHtml = createMemo(() => {
    const rawHtml = htmlContent();
    if (!rawHtml) return "";

    // Wrap <pre><code class="language-xyz">...</code></pre> with styled header & copy button
    return rawHtml.replace(
      /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
      (_match, lang, code) => {
        const displayLang = lang ? lang.toUpperCase() : "CODE";
        return `
          <div class="markdown-code-wrapper my-2 rounded-lg overflow-hidden border border-border/70 bg-zinc-950 text-zinc-100 font-mono text-[11px] shadow-xs">
            <div class="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-[10px] text-zinc-400 select-none">
              <span class="font-bold tracking-wider text-zinc-300">${displayLang}</span>
              <button
                type="button"
                class="markdown-copy-btn flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                title="Copy code to clipboard"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <pre class="p-3 overflow-x-auto leading-relaxed"><code class="${lang ? `language-${lang}` : ""}">${code}</code></pre>
          </div>
        `;
      }
    );
  });

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      class={`markdown-content text-xs leading-relaxed break-words ${props.class || ""}`}
      innerHTML={enhancedHtml()}
    />
  );
}
