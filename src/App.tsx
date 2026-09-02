import { createSignal, onMount, onCleanup } from "solid-js";
import { useApp } from "./context/AppContext";
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
import { SettingsView } from "./views/SettingsView";
import { Switch, Match } from "solid-js";

export function App() {
  const { activeView } = useApp();
  const [isSpotlightOpen, setIsSpotlightOpen] = createSignal(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = createSignal(false);
  const [isGooseOpen, setIsGooseOpen] = createSignal(false);

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

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-spotlight", handleOpenSpotlight);
      window.removeEventListener("open-shortcuts", handleOpenShortcuts);
      window.removeEventListener("toggle-goose-sidebar", handleToggleGoose);
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

      {/* Global Non-blocking Toasts */}
      <ToastContainer />
    </div>
  );
}
