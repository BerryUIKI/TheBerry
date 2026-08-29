import { createContext, createSignal, JSX, useContext, onMount } from "solid-js";
import { getAppStatus, initializeDataDir } from "../services/system";

export type ViewType = "clipboard" | "snippets" | "launcher" | "image_converter" | "file_search" | "settings";

interface AppContextType {
  activeView: () => ViewType;
  setActiveView: (view: ViewType) => void;
  isInitialized: () => boolean;
  dataDir: () => string | null;
  suggestedDataDir: () => string;
  showSetupModal: () => boolean;
  setShowSetupModal: (show: boolean) => void;
  confirmDataDirectory: (customPath: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AppContext = createContext<AppContextType>();

export function AppProvider(props: { children: JSX.Element }) {
  const [activeView, setActiveView] = createSignal<ViewType>("clipboard");
  const [isInitialized, setIsInitialized] = createSignal<boolean>(false);
  const [dataDir, setDataDir] = createSignal<string | null>(null);
  const [suggestedDataDir, setSuggestedDataDir] = createSignal<string>("");
  const [showSetupModal, setShowSetupModal] = createSignal<boolean>(false);

  const refreshStatus = async () => {
    try {
      const status = await getAppStatus();
      setIsInitialized(status.initialized);
      setDataDir(status.data_dir);
      setSuggestedDataDir(status.suggested_data_dir);
      if (!status.initialized) {
        setShowSetupModal(true);
      } else {
        setShowSetupModal(false);
      }
    } catch (e) {
      console.warn("Failed to check app status (running in browser or backend starting):", e);
      // Default fallback for browser preview
      setSuggestedDataDir("C:\\Users\\User\\Documents\\BerryAppData");
      setShowSetupModal(true);
    }
  };

  onMount(() => {
    refreshStatus();
  });

  const confirmDataDirectory = async (customPath: string) => {
    try {
      await initializeDataDir(customPath);
      setIsInitialized(true);
      setDataDir(customPath);
      setShowSetupModal(false);
    } catch (e) {
      console.error("Failed to initialize custom data directory:", e);
      throw e;
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        isInitialized,
        dataDir,
        suggestedDataDir,
        showSetupModal,
        setShowSetupModal,
        confirmDataDirectory,
        refreshStatus,
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
