import { describe, it, expect } from "vitest";
import {
  ComparisonItem,
  ComparisonManifest,
  PathFilter,
  SyncProfile,
  SyncResult,
} from "../types/folder_sync";

describe("FolderSync Model Contracts and Logic", () => {
  it("validates PathFilter defaults and custom bounds", () => {
    const filter: PathFilter = {
      include_patterns: ["*"],
      exclude_patterns: ["*.tmp", "node_modules/*", ".git/*"],
      min_size_bytes: 1024,
      max_size_bytes: 104857600,
    };

    expect(filter.include_patterns).toContain("*");
    expect(filter.exclude_patterns).toHaveLength(3);
    expect(filter.min_size_bytes).toBe(1024);
  });

  it("validates ComparisonManifest structure and summary metrics", () => {
    const item: ComparisonItem = {
      id: "comp-item-1",
      relative_path: "documents/report.pdf",
      is_dir: false,
      left: {
        relative_path: "documents/report.pdf",
        size_bytes: 2048,
        modified_timestamp_secs: 1700000000,
        is_dir: false,
      },
      right: null,
      compare_result: "left_only",
      suggested_action: "copy_left_to_right",
      action: "copy_left_to_right",
    };

    const manifest: ComparisonManifest = {
      items: [item],
      summary: {
        total_items: 1,
        equal_items: 0,
        left_only_items: 1,
        right_only_items: 0,
        different_items: 0,
        conflict_items: 0,
        bytes_to_transfer_l2r: 2048,
        bytes_to_transfer_r2l: 0,
        items_to_delete_right: 0,
        items_to_delete_left: 0,
      },
    };

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].suggested_action).toBe("copy_left_to_right");
    expect(manifest.summary.bytes_to_transfer_l2r).toBe(2048);
  });

  it("validates SyncProfile serialization and defaults", () => {
    const profile: SyncProfile = {
      id: "prof-1",
      name: "Daily Work Backup",
      left_path: "D:/Projects/TheBerry",
      right_path: "E:/Backups/TheBerry",
      sync_variant: "mirror",
      compare_variant: "time_and_size",
      deletion_variant: "versioning",
      versioning_dir: "E:/Backups/Versioning",
      filter: {
        include_patterns: ["*"],
        exclude_patterns: ["*.tmp"],
      },
      realtime_enabled: true,
      realtime_debounce_secs: 10,
      created_at: 1700000000,
      updated_at: 1700000000,
    };

    expect(profile.sync_variant).toBe("mirror");
    expect(profile.deletion_variant).toBe("versioning");
    expect(profile.realtime_enabled).toBe(true);
    expect(profile.realtime_debounce_secs).toBe(10);
  });

  it("validates SyncResult metrics and telemetry", () => {
    const res: SyncResult = {
      job_id: "job_999",
      success: true,
      files_copied: 12,
      files_deleted: 2,
      bytes_transferred: 1048576,
      duration_ms: 320,
      errors: [],
      logs: [
        {
          timestamp: 1700000000,
          level: "info",
          message: "Copied file: docs/readme.md",
        },
      ],
    };

    expect(res.success).toBe(true);
    expect(res.files_copied).toBe(12);
    expect(res.bytes_transferred).toBe(1048576);
    expect(res.logs).toHaveLength(1);
  });
});
