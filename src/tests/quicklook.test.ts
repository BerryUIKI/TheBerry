import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  getQuickLookStatus, 
  previewWithQuickLook, 
  closeQuickLook 
} from "../services/quicklook";
import { QuickLookStatus } from "../types/quicklook";

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
      binary_path: "C:\\Program Files\\QuickLook\\QuickLook.exe",
      pipe_name: "\\\\.\\pipe\\QuickLook.App.Pipe.S-1-5-21-test",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(mockStatus);

    const status = await getQuickLookStatus();
    expect(status).toEqual(mockStatus);
    expect(invoke).toHaveBeenCalledWith("get_quicklook_status", undefined);
  });

  it("triggers preview for target file", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true);

    const res = await previewWithQuickLook("C:\\Users\\User\\Documents\\image.png", "toggle");
    expect(res).toBe(true);
    expect(invoke).toHaveBeenCalledWith("quicklook_preview", {
      payload: { path: "C:\\Users\\User\\Documents\\image.png", mode: "toggle" },
    });
  });

  it("closes preview window", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await closeQuickLook();
    expect(invoke).toHaveBeenCalledWith("quicklook_close", undefined);
  });

  it("returns false gracefully if path is empty", async () => {
    const res = await previewWithQuickLook("");
    expect(res).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});
