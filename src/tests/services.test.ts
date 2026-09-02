import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeInvoke } from "../services/tauri";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("Tauri IPC Service Wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully resolves data on successful invoke", async () => {
    const mockData = { status: "ready" };
    vi.mocked(invoke).mockResolvedValueOnce(mockData);

    const result = await safeInvoke("get_app_status");
    expect(result).toEqual(mockData);
    expect(invoke).toHaveBeenCalledWith("get_app_status", undefined);
  });

  it("passes arguments correctly to invoke", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ id: "1", content: "test" });

    const payload = { content: "test", contentType: "text" };
    const result = await safeInvoke("add_clipboard_item", payload);

    expect(result).toEqual({ id: "1", content: "test" });
    expect(invoke).toHaveBeenCalledWith("add_clipboard_item", payload);
  });

  it("rejects with informative error message on invoke failure", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("Backend DB locked");

    await expect(safeInvoke("get_clipboard_history")).rejects.toThrow(
      "Backend DB locked"
    );
  });

  it("handles object errors with message property", async () => {
    vi.mocked(invoke).mockRejectedValueOnce({ message: "Network timeout" });

    await expect(safeInvoke("get_app_config")).rejects.toThrow(
      "Network timeout"
    );
  });

  it("handles empty or unknown errors gracefully", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(null);

    await expect(safeInvoke("trigger_check_update")).rejects.toThrow(
      "IPC command 'trigger_check_update' failed"
    );
  });
});
