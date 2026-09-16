import { describe, it, expect } from "vitest";
import { UpdateInfo, DownloadProgress } from "../types/updater";
import { formatBytes, formatSpeed } from "../services/updater";

describe("Updater Models and Progress State", () => {
  it("validates UpdateInfo structure correctly", () => {
    const info: UpdateInfo = {
      current_version: "0.1.0",
      latest_version: "0.2.0",
      has_update: true,
      release_notes: "Added automated multi-platform builds and auto-updater.",
      release_url: "https://github.com/BerryUIKI/TheBerry/releases/tag/v0.2.0",
      download_url: "https://github.com/BerryUIKI/TheBerry/releases/download/v0.2.0/the-berry_windows_x64.exe",
      asset_name: "the-berry_windows_x64.exe",
      published_at: "2026-08-29T12:00:00Z",
    };

    expect(info.has_update).toBe(true);
    expect(info.asset_name).toContain("windows_x64.exe");
    expect(info.download_url).toBeDefined();
  });

  it("calculates download progress percentages accurately with speed and path", () => {
    const prog: DownloadProgress = {
      bytes_downloaded: 5242880, // 5 MB
      total_bytes: 10485760, // 10 MB
      percent: 50.0,
      speed_bytes_per_sec: 2621440, // 2.5 MB/s
      done: false,
      status: "Downloading...",
      file_path: "C:\\TheBerryData\\updates\\the-berry_windows_x64.exe",
    };

    expect(prog.percent).toBe(50.0);
    expect(prog.done).toBe(false);
    expect(prog.speed_bytes_per_sec).toBe(2621440);
    expect(prog.file_path).toBeDefined();
  });

  it("formats bytes and download speed accurately", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576 * 2.5)).toBe("2.5 MB");
    expect(formatBytes(1073741824 * 1.2)).toBe("1.2 GB");

    expect(formatSpeed(0)).toBe("0 KB/s");
    expect(formatSpeed(1048576 * 3.4)).toBe("3.4 MB/s");
  });
});

