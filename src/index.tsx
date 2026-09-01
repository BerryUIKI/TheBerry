import { render } from "solid-js/web";
import { App } from "./App";
import { HudView } from "./views/HudView";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import { I18nProvider } from "./context/I18nContext";
import "./index.css";

const root = document.getElementById("root");
const isHud = typeof window !== "undefined" && window.location.search.includes("window=hud");

if (root) {
  render(
    () => (
      <ThemeProvider>
        <I18nProvider>
          <AppProvider>
            <ToastProvider>
              {isHud ? <HudView /> : <App />}
            </ToastProvider>
          </AppProvider>
        </I18nProvider>
      </ThemeProvider>
    ),
    root
  );
}
