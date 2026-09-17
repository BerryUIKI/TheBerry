import { describe, it, expect, beforeEach } from "vitest";
import {
  getDefaultNavigationState,
  loadNavigationConfig,
  saveNavigationConfig,
  reorderSidebarItems,
  toggleSidebarItemHidden,
  setSidebarItemCustomName,
  pinToSidebar,
  unpinFromSidebar,
  reorderToolboxTools,
  resetNavigationToDefault,
} from "../services/navigation";
import { DEFAULT_SIDEBAR_ORDER } from "../types/navigation";

// In-memory mock for localStorage and window.dispatchEvent
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

(globalThis as any).localStorage = localStorageMock;
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

describe("Navigation & Layout Customization Service", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("provides complete default navigation state", () => {
    const state = getDefaultNavigationState();
    expect(state.sidebarItems.length).toBe(DEFAULT_SIDEBAR_ORDER.length);
    expect(state.sidebarItems.find((it) => it.id === "clipboard")?.hidden).toBe(true);
    expect(state.sidebarItems.filter((it) => it.id !== "clipboard").every((it) => !it.hidden)).toBe(true);
    expect(state.sidebarItems[0].id).toBe("clipboard");
    expect(state.toolboxOrder).toEqual([]);
  });

  it("loads default config when localStorage is empty", () => {
    const config = loadNavigationConfig();
    expect(config.sidebarItems.length).toBe(DEFAULT_SIDEBAR_ORDER.length);
  });

  it("reorders sidebar items accurately", () => {
    // Reorder from index 0 ("snippets") to index 2 ("snippets" moves after "image_converter")
    const reordered = reorderSidebarItems(0, 2);
    expect(reordered[0].id).toBe("launcher");
    expect(reordered[2].id).toBe("snippets");

    const reloaded = loadNavigationConfig();
    expect(reloaded.sidebarItems[0].id).toBe("launcher");
    expect(reloaded.sidebarItems[2].id).toBe("snippets");
  });

  it("toggles hiding and showing sidebar items", () => {
    const hidden = toggleSidebarItemHidden("snippets", true);
    const item = hidden.find((it) => it.id === "snippets");
    expect(item?.hidden).toBe(true);

    const shown = toggleSidebarItemHidden("snippets", false);
    const itemShown = shown.find((it) => it.id === "snippets");
    expect(itemShown?.hidden).toBe(false);
  });

  it("updates custom display alias and handles reset", () => {
    const renamed = setSidebarItemCustomName("snippets", "My Prompts");
    const item = renamed.find((it) => it.id === "snippets");
    expect(item?.customName).toBe("My Prompts");

    // Reset alias
    const reset = setSidebarItemCustomName("snippets", undefined);
    const itemReset = reset.find((it) => it.id === "snippets");
    expect(itemReset?.customName).toBeUndefined();
  });

  it("pins and unpins toolbox tools to sidebar", () => {
    const pinned = pinToSidebar("batch-rename");
    const item = pinned.find((it) => it.id === "batch-rename");
    expect(item).toBeDefined();
    expect(item?.hidden).toBe(false);

    const unpinned = unpinFromSidebar("batch-rename");
    const itemUnpinned = unpinned.find((it) => it.id === "batch-rename");
    expect(itemUnpinned?.hidden).toBe(true);
  });

  it("reorders toolbox tools and saves custom order", () => {
    const initialTools = ["tool-a", "tool-b", "tool-c"];
    const reordered = reorderToolboxTools(0, 2, initialTools);
    expect(reordered).toEqual(["tool-b", "tool-c", "tool-a"]);

    const reloaded = loadNavigationConfig();
    expect(reloaded.toolboxOrder).toEqual(["tool-b", "tool-c", "tool-a"]);
  });

  it("resets navigation state back to default", () => {
    pinToSidebar("qr-code");
    setSidebarItemCustomName("clipboard", "History");
    toggleSidebarItemHidden("snippets", true);

    const resetState = resetNavigationToDefault();
    expect(resetState.sidebarItems.length).toBe(DEFAULT_SIDEBAR_ORDER.length);
    expect(resetState.sidebarItems.find((it) => it.id === "clipboard")?.hidden).toBe(true);
    expect(resetState.sidebarItems.filter((it) => it.id !== "clipboard").every((it) => !it.hidden)).toBe(true);
    expect(resetState.sidebarItems.find((it) => it.id === "qr-code")).toBeUndefined();
  });
});
