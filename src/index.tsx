/* @refresh reload */
import { render } from "solid-js/web";
import { App } from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  render(
    () => (
      <ThemeProvider>
        <AppProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    ),
    root
  );
}
