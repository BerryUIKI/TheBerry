import { ErrorBoundary, JSX } from "solid-js";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-solid";
import { useI18n } from "../../context/I18nContext";
import { logFrontendError } from "../../services/diagnostics";

export function AppErrorBoundary(props: { children: JSX.Element }) {
  const { t } = useI18n();
  let reported: unknown = null;

  return (
    <ErrorBoundary
      fallback={(error, reset) => {
        if (error !== reported) {
          reported = error;
          logFrontendError(
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error.stack : undefined
          );
        }
        return (
          <div class="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
            <div class="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div class="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} />
                <h1 class="text-sm font-semibold">{t("error_boundary.title")}</h1>
              </div>
              <p class="text-xs text-muted-foreground">{t("error_boundary.description")}</p>
              <pre class="max-h-32 overflow-auto rounded-lg bg-muted/40 p-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                {error instanceof Error ? error.message : String(error)}
              </pre>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  class="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>{t("error_boundary.reset")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw size={13} />
                  <span>{t("error_boundary.reload")}</span>
                </button>
              </div>
            </div>
          </div>
        );
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
