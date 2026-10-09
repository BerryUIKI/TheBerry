// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { QuickLookModal } from "../components/quicklook/QuickLookModal";
import { FilePreviewInfo } from "../types/quicklook";
import { getFilePreviewInfo } from "../services/quicklook";
import { openFilePath } from "../services/fileSearch";

vi.mock("../services/quicklook", () => ({ getFilePreviewInfo: vi.fn() }));
vi.mock("../services/fileSearch", () => ({ openFilePath: vi.fn(), revealInExplorer: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

function info(path: string): FilePreviewInfo {
  return { path, name: path, extension: "txt", category: "text", mime_type: "text/plain",
    size_bytes: 10, modified_timestamp: null, text_preview: `contents of ${path}`,
    base64_data: null, is_truncated: false };
}
function deferred() {
  let resolve!: (value: FilePreviewInfo) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<FilePreviewInfo>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const open = (path: string) => window.dispatchEvent(new CustomEvent("open-quicklook-modal", { detail: { path } }));

describe("QuickLook modal request ordering", () => {
  let host: HTMLDivElement;
  let dispose: () => void;
  beforeEach(() => {
    vi.resetAllMocks();
    host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(() => <QuickLookModal />, host);
  });
  afterEach(() => { dispose(); host.remove(); });

  it("keeps the latest file displayed and opened after out-of-order loads", async () => {
    const a = deferred(); const b = deferred();
    vi.mocked(getFilePreviewInfo).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    open("A.txt"); open("B.txt");
    b.resolve(info("B.txt")); await flush();
    a.resolve(info("A.txt")); await flush();
    expect(host.textContent).toContain("contents of B.txt");
    expect(host.textContent).not.toContain("contents of A.txt");
    host.querySelector<HTMLButtonElement>('button[title="Open with default application (Enter)"]')!.click();
    expect(openFilePath).toHaveBeenCalledWith("B.txt");
  });

  it.each(["success", "failure"])("does not reopen after closing a pending %s", async (result) => {
    const request = deferred();
    vi.mocked(getFilePreviewInfo).mockReturnValueOnce(request.promise);
    open("A.txt");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    if (result === "success") request.resolve(info("A.txt"));
    else request.reject(new Error("late failure"));
    await flush();
    expect(host.textContent).toBe("");
  });

  it("ignores stale errors without clearing a newer pending load", async () => {
    const a = deferred(); const b = deferred();
    vi.mocked(getFilePreviewInfo).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    open("A.txt"); open("B.txt");
    a.reject(new Error("stale error")); await flush();
    expect(host.textContent).toContain("Loading file preview");
    expect(host.textContent).not.toContain("stale error");
    b.resolve(info("B.txt")); await flush();
    expect(host.textContent).toContain("contents of B.txt");
  });
});
