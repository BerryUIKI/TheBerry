import { createSignal, onMount, onCleanup } from "solid-js";
import { useApp } from "./context/AppContext";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { FirstLaunchModal } from "./components/setup/FirstLaunchModal";
import { SpotlightModal } from "./components/SpotlightModal";
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setIsSpotlightOpen((prev) => !prev);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    const handleOpenEvent = () => setIsSpotlightOpen(true);
    window.addEventListener("open-spotlight", handleOpenEvent);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-spotlight", handleOpenEvent);
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

        {/* Dynamic View Canvas */}
        <main class="flex-1 overflow-hidden relative">
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
        </main>
      </div>

      {/* Global Spotlight HUD Modal */}
      <SpotlightModal
        isOpen={isSpotlightOpen()}
        onClose={() => setIsSpotlightOpen(false)}
      />

      {/* First Launch Data Storage Modal */}
      <FirstLaunchModal />
    </div>
  );
}
