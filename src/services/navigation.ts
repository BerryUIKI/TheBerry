import {
  DEFAULT_SIDEBAR_ORDER,
  NavItemConfig,
  NavigationState,
} from "../types/navigation";

const STORAGE_KEY = "the_berry_navigation_config";

export function getDefaultNavigationState(): NavigationState {
  return {
    sidebarItems: DEFAULT_SIDEBAR_ORDER.map((id, index) => ({
      id,
      hidden: id === "clipboard",
      order: index,
    })),
    toolboxOrder: [],
  };
}

export function loadNavigationConfig(): NavigationState {
  try {
    if (typeof localStorage === "undefined") {
      return getDefaultNavigationState();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultNavigationState();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sidebarItems)) {
      return getDefaultNavigationState();
    }

    // Ensure all default sidebar items exist in the config
    const existingIds = new Set(parsed.sidebarItems.map((item: NavItemConfig) => item.id));
    const items: NavItemConfig[] = [...parsed.sidebarItems];

    DEFAULT_SIDEBAR_ORDER.forEach((id) => {
      if (!existingIds.has(id)) {
        items.push({
          id,
          hidden: id === "clipboard",
          order: items.length,
        });
      }
    });

    items.sort((a, b) => a.order - b.order);

    return {
      sidebarItems: items,
      toolboxOrder: Array.isArray(parsed.toolboxOrder) ? parsed.toolboxOrder : [],
    };
  } catch (e) {
    console.warn("Failed to load navigation config from localStorage:", e);
    return getDefaultNavigationState();
  }
}

export function saveNavigationConfig(state: NavigationState): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("navigation-state-changed", { detail: state }));
    }
  } catch (e) {
    console.warn("Failed to save navigation config to localStorage:", e);
  }
}

export function reorderSidebarItems(fromIndex: number, toIndex: number): NavItemConfig[] {
  const current = loadNavigationConfig();
  const visibleItems = current.sidebarItems.filter((it) => !it.hidden);
  if (fromIndex < 0 || fromIndex >= visibleItems.length || toIndex < 0 || toIndex >= visibleItems.length) {
    return current.sidebarItems;
  }

  const [moved] = visibleItems.splice(fromIndex, 1);
  visibleItems.splice(toIndex, 0, moved);

  // Re-assign order values
  const hiddenItems = current.sidebarItems.filter((it) => it.hidden);
  const reordered = visibleItems.concat(hiddenItems).map((item, idx) => ({
    ...item,
    order: idx,
  }));

  saveNavigationConfig({
    ...current,
    sidebarItems: reordered,
  });

  return reordered;
}

export function toggleSidebarItemHidden(id: string, forceHidden?: boolean): NavItemConfig[] {
  const current = loadNavigationConfig();
  const items = current.sidebarItems.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        hidden: forceHidden !== undefined ? forceHidden : !item.hidden,
      };
    }
    return item;
  });

  saveNavigationConfig({
    ...current,
    sidebarItems: items,
  });

  return items;
}

export function setSidebarItemCustomName(id: string, customName?: string): NavItemConfig[] {
  const current = loadNavigationConfig();
  const items = current.sidebarItems.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        customName: customName?.trim() ? customName.trim() : undefined,
      };
    }
    return item;
  });

  saveNavigationConfig({
    ...current,
    sidebarItems: items,
  });

  return items;
}

export function pinToSidebar(id: string): NavItemConfig[] {
  const current = loadNavigationConfig();
  const exists = current.sidebarItems.find((it) => it.id === id);

  let items: NavItemConfig[];
  if (exists) {
    items = current.sidebarItems.map((it) => (it.id === id ? { ...it, hidden: false } : it));
  } else {
    items = [
      ...current.sidebarItems,
      {
        id,
        hidden: false,
        order: current.sidebarItems.length,
      },
    ];
  }

  saveNavigationConfig({
    ...current,
    sidebarItems: items,
  });

  return items;
}

export function unpinFromSidebar(id: string): NavItemConfig[] {
  return toggleSidebarItemHidden(id, true);
}

export function reorderToolboxTools(fromIndex: number, toIndex: number, currentOrder: string[]): string[] {
  if (fromIndex < 0 || fromIndex >= currentOrder.length || toIndex < 0 || toIndex >= currentOrder.length) {
    return currentOrder;
  }
  const next = [...currentOrder];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  const current = loadNavigationConfig();
  saveNavigationConfig({
    ...current,
    toolboxOrder: next,
  });

  return next;
}

export function resetNavigationToDefault(): NavigationState {
  const def = getDefaultNavigationState();
  saveNavigationConfig(def);
  return def;
}
