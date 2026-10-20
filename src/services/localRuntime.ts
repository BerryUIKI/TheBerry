import { LocalRuntimePhase, LocalRuntimeStatus } from "../types/goose";

export function isRuntimePreparing(phase?: LocalRuntimePhase): boolean {
  return phase !== undefined && ["detecting", "downloading", "verifying", "installing", "starting"].includes(phase);
}

export function runtimeDownloadPercent(status: LocalRuntimeStatus): number {
  if (status.total_bytes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor(status.downloaded_bytes / status.total_bytes * 100)));
}

export function runtimeSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function createGenerationWatchdog(shouldRun: () => boolean, onTimeout: () => void | Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const reset = () => {
    clear();
    if (shouldRun()) {
      timer = setTimeout(() => { if (shouldRun()) void onTimeout(); }, 60_000);
    }
  };
  return { clear, reset };
}
