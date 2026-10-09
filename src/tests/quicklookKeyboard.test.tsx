// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { QuickLookModal } from "../components/quicklook/QuickLookModal";
import { FilePreviewInfo } from "../types/quicklook";
import { getFilePreviewInfo } from "../services/quicklook";

vi.mock("../services/quicklook", () => ({ getFilePreviewInfo: vi.fn() }));
vi.mock("../services/fileSearch", () => ({ openFilePath: vi.fn(), revealInExplorer: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

function info(path: string): FilePreviewInfo {
  return { path, name: path, extension: "txt", category: "text", mime_type: "text/plain",
    size_bytes: 10, modified_timestamp: null, text_preview: `contents of ${path}`,
    base64_data: null, is_truncated: false };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const open = (path: string) => window.dispatchEvent(new CustomEvent("open-quicklook-modal", { detail: { path } }));

describe("QuickLook modal keyboard ownership", () => {
  let host: HTMLDivElement;
  let dispose: () => void;
  beforeEach(() => {
    vi.resetAllMocks();
    host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(() => <QuickLookModal />, host);
  });
  afterEach(() => { dispose(); host.remove(); });

  it("consumes Space before underlying window shortcuts and stays closed", async () => {
    vi.mocked(getFilePreviewInfo).mockResolvedValue(info("A.txt"));
    open("A.txt"); await flush();
    const underlying = vi.fn();
    window.addEventListener("keydown", underlying);
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
      await flush();
      expect(underlying).not.toHaveBeenCalled();
      expect(getFilePreviewInfo).toHaveBeenCalledTimes(1);
      expect(host.textContent).toBe("");
    } finally { window.removeEventListener("keydown", underlying); }
  });

  it("toggles video playback without launching another preview", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.mocked(getFilePreviewInfo).mockResolvedValue({ ...info("movie.mp4"), extension: "mp4", category: "video" });
    const underlying = vi.fn();
    window.addEventListener("keydown", underlying);
    try {
      open("movie.mp4"); await flush();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
      expect(play).toHaveBeenCalledTimes(1);
      expect(underlying).not.toHaveBeenCalled();
      expect(getFilePreviewInfo).toHaveBeenCalledTimes(1);
      expect(host.querySelector("video")).not.toBeNull();
    } finally {
      window.removeEventListener("keydown", underlying);
      play.mockRestore();
    }
  });
});
