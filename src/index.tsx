import { render } from "solid-js/web";
import { App } from "./App";
import { HudView } from "./views/HudView";
import { SettingsWindow } from "./views/SettingsWindow";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import { I18nProvider } from "./context/I18nContext";
import { QuickLookModal } from "./components/quicklook/QuickLookModal";
import { AppErrorBoundary } from "./components/common/ErrorBoundary";
import { logFrontendError } from "./services/diagnostics";
import "./index.css";

window.addEventListener("error", (event) => {
  logFrontendError(event.message || "Unknown window error", event.error?.stack);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  logFrontendError(
    reason instanceof Error ? reason.message : String(reason),
    reason instanceof Error ? reason.stack : undefined
  );
});

const root = document.getElementById("root");
const isHud = typeof window !== "undefined" && window.location.search.includes("window=hud");
const isSettingsWindow = typeof window !== "undefined" && window.location.search.includes("window=settings");

if (root) {
  render(
    () => (
      <ThemeProvider>
        <I18nProvider>
          <AppErrorBoundary>
            <AppProvider>
              <ToastProvider>
                {isHud ? (
                  <HudView />
                ) : isSettingsWindow ? (
                  <SettingsWindow />
                ) : (
                  <App />
                )}
                <QuickLookModal />
              </ToastProvider>
            </AppProvider>
          </AppErrorBoundary>
        </I18nProvider>
      </ThemeProvider>
    ),
    root
  );
}
