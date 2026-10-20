// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { LocalRuntimePanel } from "../components/goose/LocalRuntimePanel";
import { cancelLocalRuntimePreparation, getLocalRuntimeStatus, onLocalRuntimeProgress, startLocalRuntime } from "../services/goose";
import { createGenerationWatchdog } from "../services/localRuntime";
import { LocalRuntimeStatus } from "../types/goose";

vi.mock("../services/goose", () => ({
  cancelLocalRuntimePreparation: vi.fn(), getLocalRuntimeStatus: vi.fn(),
  onLocalRuntimeProgress: vi.fn(), startLocalRuntime: vi.fn(), stopLocalRuntime: vi.fn(),
}));
vi.mock("../context/I18nContext", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

function status(patch: Partial<LocalRuntimeStatus> = {}): LocalRuntimeStatus {
  return { is_running: false, backend: null, port: null, model_id: "model", base_url: null,
    error: null, phase: "idle", downloaded_bytes: 0, total_bytes: 0, available_backends: [], ...patch };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe("local runtime preparation UI", () => {
  let host: HTMLDivElement;
  let dispose: (() => void) | undefined;
  let receive: (value: LocalRuntimeStatus) => void;
  let unlisten: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    unlisten = vi.fn();
    vi.mocked(onLocalRuntimeProgress).mockImplementation(async callback => { receive = callback; return unlisten; });
    vi.mocked(getLocalRuntimeStatus).mockResolvedValue(status());
    host = document.createElement("div"); document.body.appendChild(host);
  });
  afterEach(() => { dispose?.(); dispose = undefined; host.remove(); vi.useRealTimers(); });
  const mount = () => { dispose = render(() => <LocalRuntimePanel modelId="model" />, host); };

  it("opening settings only reads status and never downloads a runtime", async () => {
    mount(); await flush();
    expect(getLocalRuntimeStatus).toHaveBeenCalledOnce();
    expect(startLocalRuntime).not.toHaveBeenCalled();
    expect(host.textContent).toContain("ai.runtime_phase_idle");
  });

  it("restores preparation progress on reopen and exposes explicit cancellation", async () => {
    vi.mocked(getLocalRuntimeStatus).mockResolvedValue(status({ phase: "downloading", backend: "cuda", downloaded_bytes: 100_000_000, total_bytes: 655_912_512 }));
    vi.mocked(cancelLocalRuntimePreparation).mockResolvedValue(true);
    mount(); await flush();
    expect(host.textContent).toContain("100.0 MB / 655.9 MB");
    expect(host.querySelector("progress")?.value).toBe(15);
    host.querySelector<HTMLButtonElement>("button")!.click(); await flush();
    expect(cancelLocalRuntimePreparation).toHaveBeenCalledOnce();
    dispose!(); host.textContent = ""; mount(); await flush();
    expect(host.textContent).toContain("100.0 MB / 655.9 MB");
    expect(startLocalRuntime).not.toHaveBeenCalled();
  });

  it("waits for user selection after GPU failure and shows sizes or cached availability", async () => {
    mount(); await flush();
    const failed = status({ phase: "failed", backend: "cuda", error: "Driver startup failed", available_backends: [
      { backend: "cuda", download_bytes: 655_912_512, is_cached: true },
      { backend: "vulkan", download_bytes: 33_331_682, is_cached: false },
      { backend: "cpu", download_bytes: 19_395_596, is_cached: false },
    ] });
    receive(failed); await flush();
    expect(startLocalRuntime).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Driver startup failed");
    expect(host.textContent).toContain("ai.runtime_cached");
    expect(host.textContent).toContain("33.3 MB");
    expect(host.textContent).toContain("19.4 MB");
    vi.mocked(startLocalRuntime).mockResolvedValue(status({ phase: "running", is_running: true, backend: "cpu" }));
    const cpu = [...host.querySelectorAll("button")].find(b => b.textContent?.includes("CPU"))!;
    cpu.click(); await flush();
    expect(startLocalRuntime).toHaveBeenCalledExactlyOnceWith("model", "cpu");
  });

  it("unsubscribes from events when removed", async () => {
    mount(); await flush(); dispose!(); dispose = undefined;
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it("does not overwrite a newer progress event with a stale status read", async () => {
    let resolve!: (value: LocalRuntimeStatus) => void;
    vi.mocked(getLocalRuntimeStatus).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    mount(); await flush();
    receive(status({ phase: "downloading", backend: "cpu", downloaded_bytes: 5_000_000, total_bytes: 19_395_596 }));
    resolve(status()); await flush();
    expect(host.textContent).toContain("5.0 MB / 19.4 MB");
    expect(host.textContent).not.toContain("ai.runtime_phase_idle");
  });
});

describe("runtime-aware chat timeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("allows preparation beyond 60 seconds and restarts the generation timeout afterwards", () => {
    let preparing = true;
    const abort = vi.fn();
    const watchdog = createGenerationWatchdog(() => !preparing, abort);
    watchdog.reset();
    vi.advanceTimersByTime(180_000);
    expect(abort).not.toHaveBeenCalled();
    preparing = false; watchdog.reset();
    vi.advanceTimersByTime(59_999); expect(abort).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(abort).toHaveBeenCalledOnce();
    watchdog.clear();
  });
  it("does not time out after cancellation or if preparation resumes", () => {
    let active = true;
    const abort = vi.fn();
    const watchdog = createGenerationWatchdog(() => active, abort);
    watchdog.reset(); active = false;
    vi.advanceTimersByTime(60_000); expect(abort).not.toHaveBeenCalled();
    active = true; watchdog.reset(); watchdog.clear();
    vi.advanceTimersByTime(60_000); expect(abort).not.toHaveBeenCalled();
  });
});
