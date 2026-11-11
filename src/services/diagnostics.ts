import { safeInvoke } from "./tauri";

export function logFrontendError(message: string, stack?: string): void {
  void safeInvoke("log_frontend_error", { message, stack: stack ?? null }).catch(() => {
    // Logging must never break the UI.
  });
}

export async function exportDiagnostics(): Promise<string> {
  return safeInvoke<string>("export_diagnostics");
}
