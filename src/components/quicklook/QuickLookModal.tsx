import { createSignal, onMount, onCleanup, Show, Switch, Match, createEffect } from "solid-js";
import { 
  X, 
  ExternalLink, 
  FolderDot, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  FileCode, 
  FileSpreadsheet, 
  File as FileIcon, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Copy, 
  Check, 
  Sun, 
  Moon, 
  Grid,
  Play,
  Volume2,
  Maximize2
} from "lucide-solid";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { getFilePreviewInfo } from "../../services/quicklook";
import { openFilePath, revealInExplorer } from "../../services/fileSearch";
import { FilePreviewInfo } from "../../types/quicklook";
import { useToast } from "../../context/ToastContext";

export function QuickLookModal() {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = createSignal(false);
  const [filePath, setFilePath] = createSignal("");
  const [previewInfo, setPreviewInfo] = createSignal<FilePreviewInfo | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [loadError, setLoadError] = createSignal<string | null>(null);

  // Viewer specific states
  const [zoomLevel, setZoomLevel] = createSignal(1);
  const [svgTheme, setSvgTheme] = createSignal<"checker" | "dark" | "light">("checker");
  const [markdownTab, setMarkdownTab] = createSignal<"rendered" | "raw">("rendered");
  const [copied, setCopied] = createSignal(false);
  const [imgDimensions, setImgDimensions] = createSignal<{ w: number; h: number } | null>(null);

  let videoElement: HTMLVideoElement | undefined;
  let modalContainerRef: HTMLDivElement | undefined;

  const loadPreview = async (targetPath: string) => {
    if (!targetPath) return;
    setFilePath(targetPath);
    setIsLoading(true);
    setLoadError(null);
    setZoomLevel(1);
    setImgDimensions(null);
    setCopied(false);
    setMarkdownTab("rendered");

    try {
      const info = await getFilePreviewInfo(targetPath);
      setPreviewInfo(info);
      setIsOpen(true);
    } catch (err) {
      setLoadError(String(err));
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPreviewInfo(null);
    setFilePath("");
  };

  const handleOpenWithDefault = async () => {
    const path = filePath();
    if (!path) return;
    try {
      await openFilePath(path);
      // Auto close preview when open action triggered (BerryUIKI fix/open-with-close-preview)
      handleClose();
    } catch (err) {
      error("Failed to open file", String(err));
    }
  };

  const handleReveal = async () => {
    const path = filePath();
    if (!path) return;
    try {
      await revealInExplorer(path);
    } catch (err) {
      error("Failed to reveal file", String(err));
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success("Copied to clipboard", "");
    } catch (err) {
      error("Failed to copy", String(err));
    }
  };

  // Video viewer shortcut & click handler (BerryUIKI feat/video-viewer-shortcuts-and-click)
  const handleVideoContainerClick = (e: MouseEvent) => {
    // If target is not native video controls bar itself
    if (videoElement) {
      if (videoElement.paused) {
        videoElement.play().catch(() => {});
      } else {
        videoElement.pause();
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) return;

    // Global modal escape
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
      return;
    }

    // Spacebar toggles preview close if not playing video
    if (e.code === "Space") {
      if (previewInfo()?.category === "video" && videoElement) {
        e.preventDefault();
        if (videoElement.paused) {
          videoElement.play().catch(() => {});
        } else {
          videoElement.pause();
        }
        return;
      }
      e.preventDefault();
      handleClose();
      return;
    }

    // Enter opens file
    if (e.key === "Enter" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      handleOpenWithDefault();
      return;
    }

    // Video specific shortcuts
    if (previewInfo()?.category === "video" && videoElement) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        videoElement.currentTime = Math.max(0, videoElement.currentTime - 5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        videoElement.currentTime = Math.min(videoElement.duration || 0, videoElement.currentTime + 5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        videoElement.volume = Math.min(1, videoElement.volume + 0.1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        videoElement.volume = Math.max(0, videoElement.volume - 0.1);
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        videoElement.muted = !videoElement.muted;
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          videoElement.requestFullscreen().catch(() => {});
        }
      }
    }
  };

  onMount(() => {
    const handleOpenModalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      if (customEvent.detail && customEvent.detail.path) {
        loadPreview(customEvent.detail.path);
      }
    };

    const handleCloseModalEvent = () => {
      handleClose();
    };

    window.addEventListener("open-quicklook-modal", handleOpenModalEvent);
    window.addEventListener("close-quicklook-modal", handleCloseModalEvent);
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("open-quicklook-modal", handleOpenModalEvent);
      window.removeEventListener("close-quicklook-modal", handleCloseModalEvent);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "image": return <ImageIcon size={16} class="text-rose-400" />;
      case "video": return <Film size={16} class="text-amber-400" />;
      case "audio": return <Music size={16} class="text-emerald-400" />;
      case "markdown":
      case "text": return <FileText size={16} class="text-blue-400" />;
      case "code": return <FileCode size={16} class="text-indigo-400" />;
      case "csv": return <FileSpreadsheet size={16} class="text-green-400" />;
      default: return <FileIcon size={16} class="text-muted-foreground" />;
    }
  };

  // Render markdown safely
  const renderMarkdown = (mdText: string) => {
    try {
      const rawHtml = marked.parse(mdText) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch {
      return mdText;
    }
  };

  // Parse simple CSV rows
  const parseCsvRows = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return lines.slice(0, 100).map((line) => {
      return line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    });
  };

  return (
    <Show when={isOpen()}>
      <div 
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-opacity duration-200 animate-in fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div 
          ref={modalContainerRef}
          class="bg-card border border-border/80 shadow-2xl rounded-2xl w-[90vw] max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-foreground animate-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div class="px-4 py-3 bg-secondary/30 border-b border-border flex items-center justify-between select-none">
            <div class="flex items-center space-x-3 min-w-0 flex-1 mr-3">
              <div class="p-1.5 rounded-lg bg-secondary/80 flex items-center justify-center flex-shrink-0">
                {previewInfo() ? getCategoryIcon(previewInfo()!.category) : <FileIcon size={16} />}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center space-x-2">
                  <h3 class="text-sm font-semibold text-foreground truncate" title={filePath()}>
                    {previewInfo()?.name || filePath().split(/[\\/]/).pop() || "QuickLook Preview"}
                  </h3>
                  <span class="px-1.5 py-0.2 text-[10px] font-mono rounded bg-primary/10 text-primary font-medium border border-primary/20 uppercase">
                    {previewInfo()?.extension || "FILE"}
                  </span>
                  <Show when={previewInfo()?.is_truncated}>
                    <span class="px-1.5 py-0.2 text-[10px] font-mono rounded bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
                      Partial 512KB
                    </span>
                  </Show>
                </div>
                <p class="text-[11px] text-muted-foreground font-mono truncate" title={filePath()}>
                  {filePath()}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div class="flex items-center space-x-2 flex-shrink-0">
              <Show when={previewInfo()?.size_bytes}>
                <span class="text-xs font-mono text-muted-foreground mr-2">
                  {formatSize(previewInfo()!.size_bytes)}
                </span>
              </Show>

              <button
                onClick={handleReveal}
                title="Reveal in File Explorer (Ctrl+E)"
                class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
              >
                <FolderDot size={15} />
              </button>

              <button
                onClick={handleOpenWithDefault}
                title="Open with default application (Enter)"
                class="px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <ExternalLink size={13} />
                <span>Open File</span>
              </button>

              <button
                onClick={handleClose}
                title="Close (Esc or Space)"
                class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Viewer Body */}
          <div class="flex-1 overflow-auto bg-background/50 flex flex-col items-center justify-center min-h-[360px] max-h-[calc(88vh-100px)] relative">
            <Show when={isLoading()}>
              <div class="flex flex-col items-center justify-center space-y-3 py-16">
                <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span class="text-xs text-muted-foreground font-mono">Loading file preview...</span>
              </div>
            </Show>

            <Show when={loadError()}>
              <div class="p-8 text-center space-y-3">
                <FileIcon size={40} class="text-destructive mx-auto opacity-70" />
                <p class="text-sm font-semibold text-destructive">{loadError()}</p>
                <button
                  onClick={handleOpenWithDefault}
                  class="px-3 py-1.5 bg-secondary text-foreground text-xs rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Try opening in system app
                </button>
              </div>
            </Show>

            <Show when={!isLoading() && !loadError() && previewInfo()}>
              <Switch>
                {/* 1. Image Viewer (including SVG with theme switcher from fix/dark-mode-and-svg-theme) */}
                <Match when={previewInfo()?.category === "image"}>
                  <div class="w-full h-full flex flex-col items-center justify-center relative p-4">
                    {/* Controls Bar */}
                    <div class="absolute top-3 right-3 z-10 flex items-center space-x-1.5 bg-card/90 backdrop-blur-md border border-border p-1 rounded-lg shadow-sm">
                      <Show when={previewInfo()?.extension === "svg"}>
                        <div class="flex items-center border-r border-border pr-1.5 mr-1 space-x-1">
                          <button
                            onClick={() => setSvgTheme("checker")}
                            title="Checkerboard background"
                            class={`p-1 rounded ${svgTheme() === "checker" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Grid size={13} />
                          </button>
                          <button
                            onClick={() => setSvgTheme("dark")}
                            title="Dark background"
                            class={`p-1 rounded ${svgTheme() === "dark" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Moon size={13} />
                          </button>
                          <button
                            onClick={() => setSvgTheme("light")}
                            title="Light background"
                            class={`p-1 rounded ${svgTheme() === "light" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Sun size={13} />
                          </button>
                        </div>
                      </Show>

                      <button
                        onClick={() => setZoomLevel((prev) => Math.max(0.2, prev - 0.2))}
                        title="Zoom out"
                        class="p-1 text-muted-foreground hover:text-foreground rounded"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span class="text-[11px] font-mono px-1 text-muted-foreground select-none">
                        {Math.round(zoomLevel() * 100)}%
                      </span>
                      <button
                        onClick={() => setZoomLevel((prev) => Math.min(4, prev + 0.2))}
                        title="Zoom in"
                        class="p-1 text-muted-foreground hover:text-foreground rounded"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <button
                        onClick={() => setZoomLevel(1)}
                        title="Reset 100%"
                        class="p-1 text-muted-foreground hover:text-foreground rounded"
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>

                    {/* SVG / Image Container */}
                    <div 
                      class={`w-full h-full flex items-center justify-center overflow-auto rounded-xl p-6 transition-colors ${
                        svgTheme() === "dark" 
                          ? "bg-zinc-950" 
                          : svgTheme() === "light" 
                          ? "bg-white" 
                          : "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)]"
                      }`}
                    >
                      <Show 
                        when={previewInfo()?.extension === "svg" && previewInfo()?.text_preview}
                        fallback={
                          <img
                            src={previewInfo()?.base64_data || ""}
                            alt={previewInfo()?.name}
                            style={{ transform: `scale(${zoomLevel()})`, "transform-origin": "center" }}
                            class="max-w-full max-h-[60vh] object-contain transition-transform select-none rounded shadow-sm"
                            onLoad={(e) => {
                              const target = e.currentTarget;
                              setImgDimensions({ w: target.naturalWidth, h: target.naturalHeight });
                            }}
                          />
                        }
                      >
                        <div 
                          style={{ transform: `scale(${zoomLevel()})`, "transform-origin": "center" }}
                          class="max-w-full max-h-[60vh] flex items-center justify-center transition-transform select-none [&>svg]:max-w-full [&>svg]:max-h-[60vh] [&>svg]:h-auto"
                          innerHTML={DOMPurify.sanitize(previewInfo()!.text_preview!)}
                        />
                      </Show>
                    </div>

                    <Show when={imgDimensions()}>
                      <div class="absolute bottom-3 left-4 text-[11px] font-mono text-muted-foreground bg-card/80 px-2 py-0.5 rounded border border-border">
                        {imgDimensions()!.w} × {imgDimensions()!.h} px
                      </div>
                    </Show>
                  </div>
                </Match>

                {/* 2. Video Viewer (with BerryUIKI feat/video-viewer-shortcuts-and-click) */}
                <Match when={previewInfo()?.category === "video"}>
                  <div 
                    class="w-full h-full flex flex-col items-center justify-center p-4 relative group"
                    onClick={handleVideoContainerClick}
                  >
                    <video
                      ref={videoElement}
                      src={previewInfo()?.base64_data || ""}
                      controls
                      autoPlay
                      class="max-w-full max-h-[62vh] rounded-xl shadow-lg bg-black cursor-pointer"
                      onClick={(e) => e.stopPropagation()} // Let custom wrapper or native controls handle click
                    />

                    {/* Shortcuts guide overlay */}
                    <div class="mt-3 flex items-center space-x-4 text-[11px] text-muted-foreground bg-card/80 border border-border px-3 py-1.5 rounded-lg select-none">
                      <span class="flex items-center space-x-1">
                        <kbd class="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">Space</kbd>
                        <span>Play/Pause</span>
                      </span>
                      <span class="flex items-center space-x-1">
                        <kbd class="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">← / →</kbd>
                        <span>±5s</span>
                      </span>
                      <span class="flex items-center space-x-1">
                        <kbd class="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">↑ / ↓</kbd>
                        <span>Volume</span>
                      </span>
                      <span class="flex items-center space-x-1">
                        <kbd class="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">M</kbd>
                        <span>Mute</span>
                      </span>
                      <span class="flex items-center space-x-1">
                        <kbd class="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px]">F</kbd>
                        <span>Fullscreen</span>
                      </span>
                    </div>
                  </div>
                </Match>

                {/* 3. Audio Viewer */}
                <Match when={previewInfo()?.category === "audio"}>
                  <div class="flex flex-col items-center justify-center space-y-6 p-12">
                    <div class="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner animate-pulse">
                      <Music size={40} />
                    </div>
                    <div class="text-center space-y-1">
                      <p class="text-base font-semibold text-foreground">{previewInfo()?.name}</p>
                      <p class="text-xs font-mono text-muted-foreground">{formatSize(previewInfo()!.size_bytes)}</p>
                    </div>
                    <audio
                      src={previewInfo()?.base64_data || ""}
                      controls
                      autoPlay
                      class="w-80 shadow-md rounded-lg"
                    />
                  </div>
                </Match>

                {/* 4. Markdown Viewer */}
                <Match when={previewInfo()?.category === "markdown"}>
                  <div class="w-full h-full flex flex-col">
                    <div class="px-4 py-2 border-b border-border flex items-center justify-between bg-secondary/20 select-none">
                      <div class="flex items-center space-x-1 bg-secondary/50 p-0.5 rounded-lg border border-border">
                        <button
                          onClick={() => setMarkdownTab("rendered")}
                          class={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            markdownTab() === "rendered" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Rendered
                        </button>
                        <button
                          onClick={() => setMarkdownTab("raw")}
                          class={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            markdownTab() === "raw" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Raw Markdown
                        </button>
                      </div>

                      <button
                        onClick={() => handleCopyText(previewInfo()?.text_preview || "")}
                        class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded flex items-center space-x-1 hover:bg-secondary transition-colors"
                      >
                        <Show when={copied()} fallback={<Copy size={13} />}>
                          <Check size={13} class="text-green-500" />
                        </Show>
                        <span>{copied() ? "Copied" : "Copy"}</span>
                      </button>
                    </div>

                    <div class="p-6 overflow-auto max-h-[62vh]">
                      <Show 
                        when={markdownTab() === "rendered"}
                        fallback={
                          <pre class="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {previewInfo()?.text_preview}
                          </pre>
                        }
                      >
                        <div 
                          class="prose dark:prose-invert max-w-none text-xs leading-relaxed"
                          innerHTML={renderMarkdown(previewInfo()?.text_preview || "")}
                        />
                      </Show>
                    </div>
                  </div>
                </Match>

                {/* 5. Code & Text Viewer */}
                <Match when={previewInfo()?.category === "code" || previewInfo()?.category === "text"}>
                  <div class="w-full h-full flex flex-col">
                    <div class="px-4 py-2 border-b border-border flex items-center justify-between bg-secondary/20 select-none">
                      <span class="text-xs font-mono text-muted-foreground uppercase">
                        {previewInfo()?.mime_type}
                      </span>
                      <button
                        onClick={() => handleCopyText(previewInfo()?.text_preview || "")}
                        class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded flex items-center space-x-1 hover:bg-secondary transition-colors"
                      >
                        <Show when={copied()} fallback={<Copy size={13} />}>
                          <Check size={13} class="text-green-500" />
                        </Show>
                        <span>{copied() ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div class="p-4 overflow-auto max-h-[62vh] bg-card/40 font-mono text-xs">
                      <pre class="text-foreground/90 leading-relaxed whitespace-pre select-text">
                        {previewInfo()?.text_preview}
                      </pre>
                    </div>
                  </div>
                </Match>

                {/* 6. CSV / Table Viewer */}
                <Match when={previewInfo()?.category === "csv"}>
                  <div class="w-full h-full flex flex-col">
                    <div class="px-4 py-2 border-b border-border flex items-center justify-between bg-secondary/20 select-none">
                      <span class="text-xs font-mono text-muted-foreground">
                        Showing first 100 rows
                      </span>
                      <button
                        onClick={() => handleCopyText(previewInfo()?.text_preview || "")}
                        class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded flex items-center space-x-1 hover:bg-secondary transition-colors"
                      >
                        <Copy size={13} />
                        <span>Copy CSV</span>
                      </button>
                    </div>
                    <div class="overflow-auto max-h-[62vh] p-2">
                      <table class="w-full text-xs text-left border-collapse font-mono">
                        <tbody>
                          {parseCsvRows(previewInfo()?.text_preview || "").map((row, rIdx) => (
                            <tr class={rIdx === 0 ? "bg-secondary/80 font-bold" : "hover:bg-secondary/30 border-b border-border/40"}>
                              {row.map((cell) => (
                                <td class="px-3 py-1.5 border-r border-border/40 truncate max-w-xs">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Match>

                {/* 7. PDF Viewer */}
                <Match when={previewInfo()?.category === "pdf"}>
                  <div class="w-full h-full flex flex-col items-center justify-center p-4">
                    <Show 
                      when={previewInfo()?.base64_data}
                      fallback={
                        <div class="p-8 text-center space-y-3">
                          <FileText size={48} class="text-primary mx-auto" />
                          <p class="text-sm font-semibold">{previewInfo()?.name}</p>
                          <button
                            onClick={handleOpenWithDefault}
                            class="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg shadow-sm"
                          >
                            Open PDF in Default Viewer
                          </button>
                        </div>
                      }
                    >
                      <object
                        data={previewInfo()?.base64_data || ""}
                        type="application/pdf"
                        class="w-full h-[64vh] rounded-xl shadow border border-border"
                      >
                        <p class="text-center p-4 text-xs text-muted-foreground">
                          PDF cannot be rendered inline. <button class="text-primary underline" onClick={handleOpenWithDefault}>Open in system viewer</button>
                        </p>
                      </object>
                    </Show>
                  </div>
                </Match>

                {/* Fallback / Binary */}
                <Match when={true}>
                  <div class="flex flex-col items-center justify-center space-y-4 p-12 text-center">
                    <div class="p-4 rounded-2xl bg-secondary/50 border border-border">
                      <FileIcon size={48} class="text-muted-foreground" />
                    </div>
                    <div class="space-y-1">
                      <p class="text-base font-semibold text-foreground">{previewInfo()?.name}</p>
                      <p class="text-xs font-mono text-muted-foreground">
                        {formatSize(previewInfo()!.size_bytes)} • {previewInfo()?.mime_type}
                      </p>
                    </div>
                    <button
                      onClick={handleOpenWithDefault}
                      class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow flex items-center space-x-2 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Open in Default Application</span>
                    </button>
                  </div>
                </Match>
              </Switch>
            </Show>
          </div>

          {/* Footer Shortcuts Hint */}
          <div class="px-4 py-2.5 bg-secondary/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground select-none">
            <div class="flex items-center space-x-4">
              <span class="flex items-center space-x-1.5">
                <kbd class="px-1.5 py-0.5 rounded bg-secondary border border-border/80 font-mono text-[10px]">Space</kbd>
                <span>/</span>
                <kbd class="px-1.5 py-0.5 rounded bg-secondary border border-border/80 font-mono text-[10px]">Esc</kbd>
                <span>Close preview</span>
              </span>
              <span class="flex items-center space-x-1.5">
                <kbd class="px-1.5 py-0.5 rounded bg-secondary border border-border/80 font-mono text-[10px]">Enter</kbd>
                <span>Open in system application</span>
              </span>
            </div>
            <span class="text-[10px] font-mono text-muted-foreground/80">
              QuickLook Engine: Active
            </span>
          </div>
        </div>
      </div>
    </Show>
  );
}
