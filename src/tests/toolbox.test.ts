import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  calculateFileHash,
  batchRenameFiles,
  compressImages,
  recognizeImageOcr,
  convertWordToPdf,
} from "../services/toolbox";

describe("Toolbox Suite Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateFileHash", () => {
    it("invokes calculate_file_hash with path", async () => {
      const mockResult = {
        file_path: "C:\\test.txt",
        file_name: "test.txt",
        file_size: 1024,
        md5: "d41d8cd98f00b204e9800998ecf8427e",
        sha1: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        sha512: "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
      };
      (invoke as any).mockResolvedValue(mockResult);

      const res = await calculateFileHash("C:\\test.txt");
      expect(invoke).toHaveBeenCalledWith("calculate_file_hash", { path: "C:\\test.txt" });
      expect(res.md5).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });
  });

  describe("batchRenameFiles", () => {
    it("invokes batch_rename_files with items list", async () => {
      const mockResult = {
        total: 2,
        success_count: 2,
        failure_count: 0,
        errors: [],
      };
      (invoke as any).mockResolvedValue(mockResult);

      const items = [
        { original_path: "C:\\old1.txt", new_path: "C:\\new1.txt" },
        { original_path: "C:\\old2.txt", new_path: "C:\\new2.txt" },
      ];
      const res = await batchRenameFiles(items);
      expect(invoke).toHaveBeenCalledWith("batch_rename_files", { items });
      expect(res.success_count).toBe(2);
    });
  });

  describe("compressImages", () => {
    it("invokes compress_images with tasks", async () => {
      const mockResults = [
        {
          source_path: "C:\\photo.png",
          output_path: "C:\\photo_compressed.webp",
          original_size: 2048000,
          compressed_size: 512000,
          saved_percentage: 75.0,
          success: true,
          error_message: null,
        },
      ];
      (invoke as any).mockResolvedValue(mockResults);

      const tasks = [
        {
          source_path: "C:\\photo.png",
          quality: 80,
          output_format: "webp" as const,
        },
      ];
      const res = await compressImages(tasks);
      expect(invoke).toHaveBeenCalledWith("compress_images", { tasks });
      expect(res[0].saved_percentage).toBe(75.0);
    });
  });

  describe("recognizeImageOcr", () => {
    it("invokes recognize_image_ocr with image path and optional language", async () => {
      const mockOcr = {
        text: "TheBerry Desktop Suite",
        lines: ["TheBerry", "Desktop Suite"],
        language: "en-US",
        success: true,
        error_message: null,
      };
      (invoke as any).mockResolvedValue(mockOcr);

      const res = await recognizeImageOcr("C:\\screenshot.png", "en-US");
      expect(invoke).toHaveBeenCalledWith("recognize_image_ocr", {
        imagePath: "C:\\screenshot.png",
        langHint: "en-US",
      });
      expect(res.text).toBe("TheBerry Desktop Suite");
      expect(res.lines.length).toBe(2);
    });
  });

  describe("convertWordToPdf", () => {
    it("invokes convert_word_to_pdf with document task", async () => {
      const mockResult = {
        source_path: "C:\\document.docx",
        output_path: "C:\\document.pdf",
        success: true,
        error_message: null,
      };
      (invoke as any).mockResolvedValue(mockResult);

      const res = await convertWordToPdf({
        source_path: "C:\\document.docx",
        output_path: "C:\\document.pdf",
      });
      expect(invoke).toHaveBeenCalledWith("convert_word_to_pdf", {
        task: {
          source_path: "C:\\document.docx",
          output_path: "C:\\document.pdf",
        },
      });
      expect(res.success).toBe(true);
      expect(res.output_path).toBe("C:\\document.pdf");
    });
  });
});
