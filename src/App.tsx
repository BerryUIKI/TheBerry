import { createSignal, onMount, onCleanup } from "solid-js";
import { useApp } from "./context/AppContext";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { FirstLaunchModal } from "./components/setup/FirstLaunchModal";
import { SpotlightModal } from "./components/SpotlightModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setIsSpotlightOpen((prev) => !prev);
      return;
    }

    // Toggle shortcuts cheatsheet with '?' (Shift + /) or 'F1'
    if (
      (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) ||
      e.key === "F1"
    ) {
      e.preventDefault();
      setIsShortcutsOpen((prev) => !prev);
      return;
    }

    if (e.key === "Escape") {
      if (isShortcutsOpen()) {
        setIsShortcutsOpen(false);
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    const handleOpenSpotlight = () => setIsSpotlightOpen(true);
    const handleOpenShortcuts = () => setIsShortcutsOpen(true);

    window.addEventListener("open-spotlight", handleOpenSpotlight);
    window.addEventListener("open-shortcuts", handleOpenShortcuts);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-spotlight", handleOpenSpotlight);
      window.removeEventListener("open-shortcuts", handleOpenShortcuts);
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
