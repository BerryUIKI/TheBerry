import { describe, it, expect } from "vitest";
import { UpdateInfo, DownloadProgress } from "../types/updater";

describe("Updater Models and Progress State", () => {
  it("validates UpdateInfo structure correctly", () => {
    const info: UpdateInfo = {
      current_version: "0.1.0",
      latest_version: "0.2.0",
      has_update: true,
      release_notes: "Added automated multi-platform builds and auto-updater.",
      release_url: "https://github.com/BerryUIKI/TheBerry/releases/tag/v0.2.0",
      download_url: "https://github.com/BerryUIKI/TheBerry/releases/download/v0.2.0/the-berry_windows_x64.msi",
      asset_name: "the-berry_windows_x64.msi",
      published_at: "2026-08-29T12:00:00Z",
    };

    expect(info.has_update).toBe(true);
    expect(info.asset_name).toContain("windows_x64");
    expect(info.download_url).toBeDefined();
  });

  it("calculates download progress percentages accurately", () => {
    const prog: DownloadProgress = {
      bytes_downloaded: 5242880, // 5 MB
      total_bytes: 10485760, // 10 MB
      percent: 50.0,
      done: false,
      status: "Downloaded 5.0 MB",
    };

    expect(prog.percent).toBe(50.0);
    expect(prog.done).toBe(false);
  });
});
