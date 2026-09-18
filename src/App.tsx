import { createSignal, onMount, onCleanup } from "solid-js";
import { useApp, ViewType } from "./context/AppContext";
import { useToast } from "./context/ToastContext";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { FirstLaunchModal } from "./components/setup/FirstLaunchModal";
import { SpotlightModal } from "./components/SpotlightModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { GooseSidebar } from "./components/goose/GooseSidebar";
import { ToastContainer } from "./components/ToastContainer";
import { ClipboardView } from "./views/ClipboardView";
import { SnippetsView } from "./views/SnippetsView";
import { LauncherView } from "./views/LauncherView";
import { ImageConverterView } from "./views/ImageConverterView";
import { FileSearchView } from "./views/FileSearchView";
import { FolderSyncView } from "./views/FolderSyncView";
import { ToolboxView } from "./views/ToolboxView";
import { SettingsView } from "./views/SettingsView";
import { UpdateModal } from "./components/updater/UpdateModal";
import { NavigationManagerModal } from "./components/settings/NavigationManagerModal";
import { QuickLookModal } from "./components/quicklook/QuickLookModal";
import { UpdateInfo } from "./types/updater";
import { Switch, Match } from "solid-js";

export function App() {
  const { activeView, setActiveView } = useApp();
  const { success } = useToast();
  const [isSpotlightOpen, setIsSpotlightOpen] = createSignal(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = createSignal(false);
  const [isGooseOpen, setIsGooseOpen] = createSignal(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = createSignal(false);
  const [updateModalInfo, setUpdateModalInfo] = createSignal<UpdateInfo | null>(null);
  const [isNavManagerOpen, setIsNavManagerOpen] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Spotlight Search (Ctrl+K)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setIsSpotlightOpen((prev) => !prev);
      return;
    }

    // Toggle Goose AI Assistant (Ctrl+J)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      setIsGooseOpen((prev) => !prev);
      return;
    }

    const isTyping =
      ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) ||
      (e.target as HTMLElement)?.isContentEditable;

    // Toggle shortcuts cheatsheet with '?' (Shift + /) or 'F1'
    if (!isTyping && (e.key === "?" || e.key === "F1")) {
      e.preventDefault();
      setIsShortcutsOpen((prev) => !prev);
      return;
    }

    if (e.key === "Escape") {
      if (isGooseOpen()) {
        setIsGooseOpen(false);
        return;
      }
      if (isShortcutsOpen()) {
        setIsShortcutsOpen(false);
        return;
      }
      if (isSpotlightOpen()) {
        setIsSpotlightOpen(false);
        return;
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    const handleOpenSpotlight = () => setIsSpotlightOpen(true);
    const handleOpenShortcuts = () => setIsShortcutsOpen(true);
    const handleToggleGoose = () => setIsGooseOpen((prev) => !prev);

    window.addEventListener("open-spotlight", handleOpenSpotlight);
    window.addEventListener("open-shortcuts", handleOpenShortcuts);
    window.addEventListener("toggle-goose-sidebar", handleToggleGoose);
    const handleOpenGoose = () => setIsGooseOpen(true);
    window.addEventListener("open-goose", handleOpenGoose);

    const handleOpenUpdateModal = (e: Event) => {
      const customEvent = e as CustomEvent<UpdateInfo | null>;
      if (customEvent.detail) {
        setUpdateModalInfo(customEvent.detail);
      }
      setIsUpdateModalOpen(true);
    };
    window.addEventListener("open-update-modal", handleOpenUpdateModal);

    const handleOpenNavManager = () => setIsNavManagerOpen(true);
    window.addEventListener("open-navigation-manager", handleOpenNavManager);

    let unlistenNavigate: (() => void) | null = null;
    let unlistenCleared: (() => void) | null = null;

    listen<string>("navigate-view", (event) => {
      const targetView = event.payload as ViewType;
      if (targetView) {
        setActiveView(targetView);
      }
    }).then((unlisten) => {
      unlistenNavigate = unlisten;
    });

    listen("clipboard-cleared", () => {
      success("Clipboard Cleared", "Unpinned clips removed via system tray");
      window.dispatchEvent(new CustomEvent("refresh-clipboard-history"));
    }).then((unlisten) => {
      unlistenCleared = unlisten;
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-spotlight", handleOpenSpotlight);
      window.removeEventListener("open-shortcuts", handleOpenShortcuts);
      window.removeEventListener("toggle-goose-sidebar", handleToggleGoose);
      window.removeEventListener("open-goose", handleOpenGoose);
      window.removeEventListener("open-update-modal", handleOpenUpdateModal);
      window.removeEventListener("open-navigation-manager", handleOpenNavManager);
      if (unlistenNavigate) unlistenNavigate();
      if (unlistenCleared) unlistenCleared();
    });
  });

  return (
    <div class="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Custom Frameless Titlebar */}
      <TitleBar />

      {/* Main Workspace Body */}
      <div class="flex-1 flex overflow-hidden">
        {/* Persistent Sidebar */}
        <Sidebar />

        {/* Dynamic View Canvas with smooth view-transition */}
        <main class="flex-1 overflow-hidden relative">
          <div class="h-full w-full view-transition" key={activeView()}>
            <Switch>
              <Match when={activeView() === "clipboard"}>
                <ClipboardView />
              </Match>
              <Match when={activeView() === "snippets"}>
                <SnippetsView />
              </Match>
              <Match when={activeView() === "launcher"}>
                <LauncherView />
              </Match>
              <Match when={activeView() === "image_converter"}>
                <ImageConverterView />
              </Match>
              <Match when={activeView() === "file_search"}>
                <FileSearchView />
              </Match>
              <Match when={activeView() === "folder_sync"}>
                <FolderSyncView />
              </Match>
              <Match when={activeView() === "toolbox"}>
                <ToolboxView />
              </Match>
              <Match when={activeView() === "settings"}>
                <SettingsView />
              </Match>
            </Switch>
          </div>
        </main>
      </div>

      {/* Goose AI Conversation Drawer Panel */}
      <GooseSidebar
        isOpen={isGooseOpen()}
        onClose={() => setIsGooseOpen(false)}
      />

      {/* Global Spotlight HUD Modal */}
      <SpotlightModal
        isOpen={isSpotlightOpen()}
        onClose={() => setIsSpotlightOpen(false)}
      />

      {/* Keyboard Shortcuts Cheat-Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen()}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* First Launch Data Storage Modal */}
      <FirstLaunchModal />

      {/* Global Software Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen()}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateModalInfo()}
      />

      {/* Global Sidebar Navigation & Layout Customization Modal */}
      <NavigationManagerModal
        isOpen={isNavManagerOpen()}
        onClose={() => setIsNavManagerOpen(false)}
      />

      {/* Global QuickLook Instant File Preview Modal */}
      <QuickLookModal />

      {/* Global Non-blocking Toasts */}
      <ToastContainer />
    </div>
  );
}
