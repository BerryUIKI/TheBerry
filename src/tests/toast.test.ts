import { describe, it, expect } from "vitest";
import { ToastItem } from "../types/toast";

describe("Toast Notification System", () => {
  it("constructs toast items with expected types and durations", () => {
    const successToast: ToastItem = {
      id: "toast_1",
      type: "success",
      title: "Settings Saved",
      message: "Config updated successfully",
      durationMs: 3000,
    };

    const errorToast: ToastItem = {
      id: "toast_2",
      type: "error",
      title: "Conversion Failed",
      message: "Source file not found",
      durationMs: 4500,
    };

    expect(successToast.type).toBe("success");
    expect(errorToast.type).toBe("error");
    expect(successToast.title).toBe("Settings Saved");
    expect(errorToast.durationMs).toBe(4500);
  });
});
