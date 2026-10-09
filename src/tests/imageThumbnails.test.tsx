// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { ImageThumbnail } from "../components/imageConverter/ImageThumbnail";
import { ImageConverterView } from "../views/ImageConverterView";
import { getImageThumbnail, scanImagePaths } from "../services/imageConverter";
import { open } from "@tauri-apps/plugin-dialog";

const drag = vi.hoisted(() => ({ callback: undefined as ((event: any) => Promise<void>) | undefined }));
vi.mock("../services/imageConverter", () => ({
  getImageThumbnail: vi.fn(), scanImagePaths: vi.fn(), convertSingleImage: vi.fn(),
}));
vi.mock("../services/quicklook", () => ({ previewWithQuickLook: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ onDragDropEvent: vi.fn(async (callback) => {
    drag.callback = callback;
    return vi.fn();
  }) }),
}));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }) }));
vi.mock("../context/I18nContext", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const PNG = "data:image/png;base64,aW1hZ2U=";
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
class Observer {
  static instances: Observer[] = [];
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(private callback: IntersectionObserverCallback) { Observer.instances.push(this); }
  enter() { this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}

describe("Image Converter thumbnails", () => {
  let host: HTMLDivElement;
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.resetAllMocks();
    Observer.instances = [];
    drag.callback = undefined;
    vi.stubGlobal("IntersectionObserver", Observer);
    vi.mocked(getImageThumbnail).mockResolvedValue(PNG);
    host = document.createElement("div");
    document.body.appendChild(host);
  });
  afterEach(() => { dispose?.(); host.remove(); vi.unstubAllGlobals(); });
  const button = (key: string) => Array.from(host.querySelectorAll("button")).find((node) => node.textContent?.includes(key))!;

  it("waits until a row is visible before requesting its thumbnail", async () => {
    dispose = render(() => <ImageThumbnail path="photo.png" />, host);
    await flush();
    expect(getImageThumbnail).not.toHaveBeenCalled();
    Observer.instances[0].enter(); await flush();
    expect(getImageThumbnail).toHaveBeenCalledExactlyOnceWith("photo.png");
    expect(host.querySelector("img")?.getAttribute("src")).toBe(PNG);
    expect(Observer.instances[0].disconnect).toHaveBeenCalled();
  });

  it.each(["unavailable", "rejected", "invalid image"])("keeps an icon when the preview is %s", async (state) => {
    if (state === "unavailable") vi.mocked(getImageThumbnail).mockResolvedValue(null);
    if (state === "rejected") vi.mocked(getImageThumbnail).mockRejectedValue(new Error("unreadable file"));
    dispose = render(() => <ImageThumbnail path="broken.heic" />, host);
    await flush(); Observer.instances[0].enter(); await flush();
    if (state === "invalid image") host.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it.each(["file selection", "folder import", "drag-and-drop"])("shows previews after %s and clears them with the queue", async (method) => {
    dispose = render(() => <ImageConverterView />, host);
    await flush();
    if (method === "file selection") {
      vi.mocked(open).mockResolvedValue(["photo.png"]);
      button("image_converter.browse_files").click();
    } else {
      vi.mocked(scanImagePaths).mockResolvedValue(["photo.png"]);
      if (method === "folder import") {
        vi.mocked(open).mockResolvedValue("photos");
        button("image_converter.browse_folder").click();
      } else {
        await drag.callback!({ payload: { type: "drop", paths: ["photos"] } });
      }
    }
    await vi.waitFor(() => expect(Observer.instances).toHaveLength(1));
    Observer.instances[0].enter(); await flush();
    expect(host.querySelector("img")?.getAttribute("src")).toBe(PNG);
    expect(host.textContent).toContain("photo.png");
    button("image_converter.clear_all").click();
    expect(host.querySelector("img")).toBeNull();
    expect(Observer.instances[0].disconnect).toHaveBeenCalled();
  });

  it("does not bring a removed row back after its thumbnail finishes", async () => {
    let resolve!: (url: string) => void;
    vi.mocked(getImageThumbnail).mockReturnValue(new Promise((done) => { resolve = done; }));
    vi.mocked(open).mockResolvedValue(["photo.png"]);
    dispose = render(() => <ImageConverterView />, host);
    await flush(); button("image_converter.browse_files").click();
    await vi.waitFor(() => expect(Observer.instances).toHaveLength(1));
    Observer.instances[0].enter(); await flush();
    host.querySelector<HTMLButtonElement>('button[title="Remove from list"]')!.click();
    resolve(PNG); await flush();
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).not.toContain("photo.png");
  });
});
