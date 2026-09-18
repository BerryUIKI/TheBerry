// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  getQuickLookStatus, 
  previewWithQuickLook, 
  getFilePreviewInfo,
  triggerBuiltinPreview,
  closeQuickLook 
} from "../services/quicklook";
import { FilePreviewInfo, QuickLookStatus } from "../types/quicklook";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("QuickLook Service & IPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves QuickLook status accurately", async () => {
    const mockStatus: QuickLookStatus = {
      is_supported_os: true,
      is_installed: true,
      is_running: true,
      is_enabled: true,
      is_embedded: true,
      has_builtin_fallback: true,
      binary_path: "C:\\Program Files\\QuickLook\\QuickLook.exe",
      pipe_name: "\\\\.\\pipe\\QuickLook.App.Pipe.S-1-5-21-test",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(mockStatus);

    const status = await getQuickLookStatus();
    expect(status).toEqual(mockStatus);
    expect(invoke).toHaveBeenCalledWith("get_quicklook_status", undefined);
  });

  it("retrieves file preview info", async () => {
    const mockInfo: FilePreviewInfo = {
      path: "C:\\Users\\User\\Documents\\sample.mp4",
      name: "sample.mp4",
      extension: "mp4",
      size_bytes: 10240,
      modified_timestamp: 1670000000,
      mime_type: "video/mp4",
      category: "video",
      text_preview: null,
      base64_data: "data:video/mp4;base64,AAAA",
      is_truncated: false,
    };
    vi.mocked(invoke).mockResolvedValueOnce(mockInfo);

    const info = await getFilePreviewInfo("C:\\Users\\User\\Documents\\sample.mp4");
    expect(info).toEqual(mockInfo);
    expect(invoke).toHaveBeenCalledWith("get_quicklook_file_preview", { path: "C:\\Users\\User\\Documents\\sample.mp4" });
  });

  it("triggers preview via external pipe when QuickLook is running", async () => {
    const runningStatus: QuickLookStatus = {
      is_supported_os: true,
      is_installed: true,
      is_running: true,
      is_enabled: true,
      is_embedded: true,
      has_builtin_fallback: true,
      binary_path: "C:\\QuickLook.exe",
      pipe_name: "\\\\.\\pipe\\test",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(runningStatus);
    vi.mocked(invoke).mockResolvedValueOnce(true);

    const res = await previewWithQuickLook("C:\\Users\\User\\Documents\\image.png", "toggle");
    expect(res).toBe(true);
    expect(invoke).toHaveBeenCalledWith("quicklook_preview", {
      payload: { path: "C:\\Users\\User\\Documents\\image.png", mode: "toggle" },
    });
  });

  it("falls back to built-in modal event when QuickLook host is not running", async () => {
    const stoppedStatus: QuickLookStatus = {
      is_supported_os: true,
      is_installed: false,
      is_running: false,
      is_enabled: true,
      is_embedded: false,
      has_builtin_fallback: true,
      binary_path: null,
      pipe_name: null,
      error_message: "QuickLook is not detected.",
    };
    vi.mocked(invoke).mockResolvedValueOnce(stoppedStatus);

    let dispatchedEventDetail: any = null;
    const listener = (e: any) => {
      dispatchedEventDetail = e.detail;
    };
    window.addEventListener("open-quicklook-modal", listener);

    const res = await previewWithQuickLook("C:\\Users\\User\\test.md");
    expect(res).toBe(true);
    expect(dispatchedEventDetail).toEqual({ path: "C:\\Users\\User\\test.md" });

    window.removeEventListener("open-quicklook-modal", listener);
  });

  it("does not preview when QuickLook is disabled in config", async () => {
    const disabledStatus: QuickLookStatus = {
      is_supported_os: true,
      is_installed: true,
      is_running: true,
      is_enabled: false,
      is_embedded: true,
      has_builtin_fallback: true,
      binary_path: "C:\\QuickLook.exe",
      pipe_name: "\\\\.\\pipe\\test",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(disabledStatus);

    const res = await previewWithQuickLook("C:\\Users\\User\\test.md");
    expect(res).toBe(false);
  });

  it("triggers builtin preview directly", async () => {
    let triggered = false;
    const listener = () => { triggered = true; };
    window.addEventListener("open-quicklook-modal", listener);

    await triggerBuiltinPreview("C:\\file.svg");
    expect(triggered).toBe(true);

    window.removeEventListener("open-quicklook-modal", listener);
  });

  it("closes preview window and notifies modal", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    let closed = false;
    const listener = () => { closed = true; };
    window.addEventListener("close-quicklook-modal", listener);

    await closeQuickLook();
    expect(closed).toBe(true);
    expect(invoke).toHaveBeenCalledWith("quicklook_close", undefined);

    window.removeEventListener("close-quicklook-modal", listener);
  });

  it("returns false gracefully if path is empty", async () => {
    const res = await previewWithQuickLook("");
    expect(res).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
