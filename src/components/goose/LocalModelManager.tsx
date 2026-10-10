import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";
import {
  cancelLocalModelDownload,
  downloadLocalModel,
  getLocalRuntimeStatus,
  importLocalModel,
  listLocalModels,
  onLocalModelDownloadProgress,
  removeLocalModel,
  startLocalRuntime,
  stopLocalRuntime,
} from "../../services/goose";
import { LocalModel, LocalModelDownloadProgress, LocalRuntimeStatus } from "../../types/goose";
import { Check, Download, ExternalLink, FileUp, Play, RefreshCw, Server, Square, Trash2 } from "lucide-solid";

interface Props {
  selectedModelId?: string | null;
  onSelectModel: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${bytes} B`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function progressPercent(progress: LocalModelDownloadProgress): number {
  if (!progress.total_bytes) return 0;
  return Math.min(100, Math.floor((progress.downloaded_bytes / progress.total_bytes) * 100));
}

export function LocalModelManager(props: Props) {
  const { t } = useI18n();
  const { success, error } = useToast();
  const [models, setModels] = createSignal<LocalModel[]>([]);
  const [runtime, setRuntime] = createSignal<LocalRuntimeStatus | null>(null);
  const [downloadProgress, setDownloadProgress] = createSignal<LocalModelDownloadProgress | null>(null);
  const [downloadBusy, setDownloadBusy] = createSignal(false);
  const [cancelRequested, setCancelRequested] = createSignal(false);
  const [runtimeBusy, setRuntimeBusy] = createSignal(false);
  const [importBusy, setImportBusy] = createSignal(false);
  const [loadError, setLoadError] = createSignal("");
  let unlisten: (() => void) | undefined;
  let disposed = false;

  const refresh = async () => {
    try {
      const [nextModels, nextRuntime] = await Promise.all([listLocalModels(), getLocalRuntimeStatus()]);
      if (!disposed) {
        setModels(nextModels);
        setRuntime(nextRuntime);
        setLoadError("");
      }
    } catch (e: any) {
      if (!disposed) setLoadError(e?.message || String(e));
    }
  };

  onMount(async () => {
    try {
      unlisten = await onLocalModelDownloadProgress((progress) => {
        setDownloadProgress(progress);
      });
      if (disposed) unlisten();
    } catch (e) {
      console.warn("Could not listen for model download progress:", e);
    }
    await refresh();
  });

  onCleanup(() => {
    disposed = true;
    unlisten?.();
  });

  const handleDownload = async (model: LocalModel) => {
    setDownloadBusy(true);
    setCancelRequested(false);
    setDownloadProgress({
      model_id: model.id,
      downloaded_bytes: 0,
      total_bytes: model.size_bytes,
      is_complete: false,
      is_cancelled: false,
      error: null,
    });
    try {
      await downloadLocalModel(model.id);
      await refresh();
      if (!cancelRequested() && !downloadProgress()?.is_cancelled) {
        props.onSelectModel(model.id);
        success(t("ai.local_downloaded"), model.name);
      }
    } catch (e: any) {
      setDownloadProgress(null);
      error(t("ai.local_download_failed"), e?.message || String(e));
    } finally {
      setDownloadBusy(false);
      setCancelRequested(false);
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    setCancelRequested(true);
    try {
      await cancelLocalModelDownload(modelId);
    } catch (e: any) {
      error(t("ai.local_download_failed"), e?.message || String(e));
    }
  };

  const handleImport = async () => {
    setImportBusy(true);
    try {
      const selection = await open({
        multiple: false,
        filters: [{ name: "GGUF model", extensions: ["gguf"] }],
      });
      const path = Array.isArray(selection) ? selection[0] : selection;
      if (!path) return;
      const model = await importLocalModel(path);
      await refresh();
      props.onSelectModel(model.id);
      success(t("ai.local_import_success"), model.name);
    } catch (e: any) {
      error(t("ai.local_import_failed"), e?.message || String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const handleStart = async () => {
    const model = models().find((candidate) => candidate.id === props.selectedModelId && candidate.is_installed);
    if (!model) {
      error(t("ai.local_model_not_installed"), t("ai.local_select_installed"));
      return;
    }
    setRuntimeBusy(true);
    try {
      const next = await startLocalRuntime(model.id);
      setRuntime(next);
      success(t("ai.local_runtime_started"), `${model.name} · ${next.backend?.toUpperCase() || ""}`);
    } catch (e: any) {
      error(t("ai.local_runtime_failed"), e?.message || String(e));
    } finally {
      setRuntimeBusy(false);
    }
  };

  const handleStop = async () => {
    setRuntimeBusy(true);
    try {
      await stopLocalRuntime();
      await refresh();
    } catch (e: any) {
      error(t("ai.local_runtime_failed"), e?.message || String(e));
    } finally {
      setRuntimeBusy(false);
    }
  };

  const handleRemove = async (model: LocalModel) => {
    if (!window.confirm(t("ai.local_remove_confirm", { name: model.name }))) return;
    try {
      await removeLocalModel(model.id);
      if (props.selectedModelId === model.id) props.onSelectModel("");
      await refresh();
      success(t("ai.local_model_removed"), model.name);
    } catch (e: any) {
      error(t("ai.local_remove_failed"), e?.message || String(e));
    }
  };

  return (
    <section class="p-3.5 rounded-xl border border-border bg-card/60 space-y-3 shadow-xs">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <Server size={15} class="text-primary mt-0.5" />
          <div>
            <h4 class="font-semibold text-foreground">{t("ai.local_title")}</h4>
            <p class="text-[10px] text-muted-foreground leading-relaxed">{t("ai.local_desc")}</p>
          </div>
        </div>
        <button type="button" onClick={refresh} class="p-1 rounded text-muted-foreground hover:text-foreground" title={t("ai.local_refresh")}>
          <RefreshCw size={12} />
        </button>
      </div>

      <p class="rounded-lg border border-border/70 bg-secondary/30 p-2 text-[10px] text-muted-foreground leading-relaxed">
        {t("ai.local_runtime_notice")}
      </p>
      <Show when={loadError()}>
        <p class="text-[10px] text-destructive">{loadError()}</p>
      </Show>

      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold text-foreground">{t("ai.local_models")}</span>
        <button
          type="button"
          disabled={importBusy()}
          onClick={handleImport}
          class="px-2.5 py-1.5 rounded-md border border-border bg-secondary/70 hover:bg-secondary text-[10px] font-medium flex items-center gap-1.5 disabled:opacity-50"
        >
          <FileUp size={12} />
          {importBusy() ? t("ai.local_importing") : t("ai.local_import")}
        </button>
      </div>

      <div class="space-y-2">
        <For each={models()}>
          {(model) => {
            const isSelected = () => props.selectedModelId === model.id;
            const activeProgress = () => downloadProgress()?.model_id === model.id ? downloadProgress() : null;
            return (
              <article class={`rounded-lg border p-2.5 space-y-2 ${isSelected() ? "border-primary/60 bg-primary/5" : "border-border bg-background/50"}`}>
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-foreground text-[11px] truncate">{model.name}</span>
                      <Show when={model.is_recommended}>
                        <span class="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[8px] uppercase tracking-wide">{t("ai.local_recommended")}</span>
                      </Show>
                    </div>
                    <div class="mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] text-muted-foreground">
                      <span>{t("ai.local_size")}: {formatBytes(model.size_bytes)}</span>
                      <span>{t("ai.local_license")}: {model.license}</span>
                      <span>{t("ai.local_tools")}: {t(`ai.local_tools_${model.tool_support}` as any)}</span>
                    </div>
                  </div>
                  <Show when={model.is_installed}>
                    <button type="button" onClick={() => props.onSelectModel(model.id)} class={`shrink-0 px-2 py-1 rounded-md border text-[9px] font-medium ${isSelected() ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <span class="flex items-center gap-1">{isSelected() ? <Check size={10} /> : null}{isSelected() ? t("ai.local_selected") : t("ai.local_use")}</span>
                    </button>
                  </Show>
                </div>

                <p class="text-[9px] text-muted-foreground">{model.hardware_requirements}</p>
                <div class="flex items-center justify-between gap-2 text-[9px]">
                  <a href={model.source_url || "https://huggingface.co"} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-primary hover:underline min-w-0 truncate">
                    {model.source || t("ai.local_imported_source")}<ExternalLink size={9} />
                  </a>
                  <span class="font-mono text-muted-foreground" title={`${t("ai.local_revision")}: ${model.revision}\nSHA-256: ${model.sha256}`}>
                    {model.revision === "local-import" ? "local" : model.revision.slice(0, 7)} · {model.sha256.slice(0, 7)}
                  </span>
                </div>

                <Show when={model.tool_support !== "verified"}>
                  <p class="text-[9px] text-amber-600 dark:text-amber-400 leading-relaxed">{t("ai.local_tools_unverified_notice")}</p>
                </Show>

                <Show when={!model.is_installed && model.is_recommended}>
                  <Show
                    when={activeProgress() && !activeProgress()!.is_cancelled && !activeProgress()!.is_complete}
                    fallback={
                      <button type="button" onClick={() => handleDownload(model)} disabled={downloadBusy()} class="w-full px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <Download size={11} />{t("ai.local_download")}
                      </button>
                    }
                  >
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>{formatBytes(activeProgress()!.downloaded_bytes)} / {activeProgress()!.total_bytes ? formatBytes(activeProgress()!.total_bytes!) : "…"}</span>
                        <span>{progressPercent(activeProgress()!)}%</span>
                      </div>
                      <div class="h-1.5 rounded-full bg-secondary overflow-hidden"><div class="h-full bg-primary transition-all" style={{ width: `${progressPercent(activeProgress()!)}%` }} /></div>
                      <button type="button" onClick={() => handleCancelDownload(model.id)} class="w-full px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground text-[9px]">{t("ai.local_cancel_download")}</button>
                    </div>
                  </Show>
                  <Show when={activeProgress()?.is_cancelled}>
                    <p class="text-[9px] text-muted-foreground">{t("ai.local_download_paused")}</p>
                  </Show>
                </Show>

                <Show when={model.is_installed}>
                  <div class="flex justify-end">
                    <button type="button" onClick={() => handleRemove(model)} class="inline-flex items-center gap-1 text-[9px] text-muted-foreground hover:text-destructive"><Trash2 size={10} />{t("ai.local_remove")}</button>
                  </div>
                </Show>
              </article>
            );
          }}
        </For>
      </div>

      <div class="rounded-lg border border-border p-2.5 flex items-center justify-between gap-3">
        <div>
          <p class="text-[10px] font-semibold text-foreground">{t("ai.local_runtime_status")}</p>
          <p class="text-[9px] text-muted-foreground">
            {runtime()?.is_running
              ? `${t("ai.local_running")}: ${runtime()?.backend?.toUpperCase()} · 127.0.0.1:${runtime()?.port}`
              : t("ai.local_stopped")}
          </p>
        </div>
        <Show when={runtime()?.is_running} fallback={
          <button type="button" onClick={handleStart} disabled={runtimeBusy()} class="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] flex items-center gap-1 disabled:opacity-50">
            <Play size={10} />{runtimeBusy() ? t("ai.local_starting") : t("ai.local_start")}
          </button>
        }>
          <button type="button" onClick={handleStop} disabled={runtimeBusy()} class="px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-destructive text-[10px] flex items-center gap-1 disabled:opacity-50">
            <Square size={10} />{runtimeBusy() ? t("ai.local_stopping") : t("ai.local_stop")}
          </button>
        </Show>
      </div>
      <Show when={runtime()?.error}>
        <p class="text-[9px] text-destructive">{runtime()?.error}</p>
      </Show>
      <p class="text-[9px] text-muted-foreground">{t("ai.local_resume_info")}</p>
    </section>
  );
}
