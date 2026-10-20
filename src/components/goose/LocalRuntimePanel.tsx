import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useI18n } from "../../context/I18nContext";
import { cancelLocalRuntimePreparation, getLocalRuntimeStatus, onLocalRuntimeProgress, startLocalRuntime, stopLocalRuntime } from "../../services/goose";
import { isRuntimePreparing, runtimeDownloadPercent, runtimeSize } from "../../services/localRuntime";
import { LocalRuntimeBackend, LocalRuntimeStatus } from "../../types/goose";

interface Props {
  modelId?: string | null;
  onChange?: (status: LocalRuntimeStatus) => void;
}

export function LocalRuntimePanel(props: Props) {
  const { t } = useI18n();
  const [status, setStatus] = createSignal<LocalRuntimeStatus>();
  const [error, setError] = createSignal("");
  const [requestBusy, setRequestBusy] = createSignal(false);
  const busy = () => requestBusy() || isRuntimePreparing(status()?.phase);
  let disposed = false;
  let unlisten: (() => void) | undefined;
  let refreshing = false;
  let eventRevision = 0;

  const receive = (value: LocalRuntimeStatus) => {
    if (disposed) return;
    setStatus(value);
    if (value.phase !== "failed") setError("");
    props.onChange?.(value);
  };
  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    const revision = eventRevision;
    try {
      const snapshot = await getLocalRuntimeStatus();
      if (revision === eventRevision) receive(snapshot);
    }
    catch (e) { if (!disposed) setError(String(e)); }
    finally { refreshing = false; }
  };

  onMount(async () => {
    try {
      unlisten = await onLocalRuntimeProgress(value => { eventRevision++; receive(value); });
      if (disposed) { unlisten(); return; }
    } catch (e) { if (!disposed) setError(String(e)); }
    await refresh();
  });
  // Refresh also detects unexpected process exits and restores state after reopening.
  const timer = setInterval(refresh, 2000);
  onCleanup(() => { disposed = true; clearInterval(timer); unlisten?.(); });

  const start = async (backend?: LocalRuntimeBackend) => {
    if (!props.modelId || busy()) return;
    setError("");
    setRequestBusy(true);
    try { receive(await startLocalRuntime(props.modelId, backend)); }
    catch (e) { if (!disposed) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (!disposed) { setRequestBusy(false); await refresh(); } }
  };
  const stop = async () => {
    setRequestBusy(true);
    try { await stopLocalRuntime(); await refresh(); }
    catch (e) { if (!disposed) setError(String(e)); }
    finally { if (!disposed) setRequestBusy(false); }
  };
  const cancel = async () => {
    try { await cancelLocalRuntimePreparation(); }
    catch (e) { if (!disposed) setError(String(e)); }
  };

  return (
    <section class="rounded-lg border border-border bg-background/50 p-2.5 space-y-2" aria-label={t("ai.local_runtime_status")}>
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0" role="status" aria-live="polite">
          <p class="text-[10px] font-semibold text-foreground">{t("ai.local_runtime_status")}</p>
          <p class="text-[10px] text-muted-foreground">
            {t(`ai.runtime_phase_${status()?.phase || "idle"}` as any)}
            <Show when={status()?.backend}> · {status()?.backend?.toUpperCase()}</Show>
          </p>
        </div>
        <Show when={busy()} fallback={
          <Show when={status()?.is_running} fallback={
            <button type="button" disabled={!props.modelId} onClick={() => start(status()?.phase === "failed" || status()?.phase === "cancelled" ? status()?.backend ?? undefined : undefined)} class="px-2.5 py-1 rounded bg-primary text-primary-foreground text-[10px] disabled:opacity-50">{t(status()?.phase === "failed" ? "ai.runtime_retry" : "ai.local_start")}</button>
          }>
            <button type="button" onClick={stop} class="px-2.5 py-1 rounded border border-border text-[10px]">{t("ai.local_stop")}</button>
          </Show>
        }>
          <button type="button" onClick={cancel} class="px-2.5 py-1 rounded border border-border text-[10px]">{t("ai.runtime_cancel")}</button>
        </Show>
      </div>
      <Show when={status()?.phase === "downloading"}>
        <p class="text-[10px] text-muted-foreground">{runtimeSize(status()!.downloaded_bytes)} / {runtimeSize(status()!.total_bytes)} · {runtimeDownloadPercent(status()!)}%</p>
        <progress class="w-full h-1.5" max="100" value={runtimeDownloadPercent(status()!)} aria-label={t("ai.runtime_phase_downloading")} />
      </Show>
      <Show when={status()?.error || error()}>
        <p class="max-h-28 overflow-y-auto whitespace-pre-wrap text-[10px] text-destructive break-words" role="alert">{status()?.error || error()}</p>
      </Show>
      <Show when={!busy() && (status()?.phase === "failed" || status()?.phase === "cancelled")}>
        <p class="text-[10px] text-muted-foreground">{t("ai.runtime_choose_backend")}</p>
        <div class="flex flex-wrap gap-1.5">
          <For each={status()?.available_backends}>
            {(option) => (
              <button type="button" disabled={!props.modelId} onClick={() => start(option.backend)} class="px-2 py-1 rounded border border-border text-[10px] hover:bg-secondary disabled:opacity-50">
                {option.backend === status()?.backend ? t("ai.runtime_retry") : t("ai.runtime_use")} {option.backend.toUpperCase()}
                {" · "}{option.is_cached ? t("ai.runtime_cached") : runtimeSize(option.download_bytes)}
              </button>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
