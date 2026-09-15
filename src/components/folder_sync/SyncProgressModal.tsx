import { Show } from "solid-js";
import { CheckCircle2, Loader2, XCircle, AlertTriangle, ShieldCheck } from "lucide-solid";
import { SyncProgressEvent, SyncResult } from "../../types/folder_sync";

interface SyncProgressModalProps {
  isOpen: boolean;
  progress: SyncProgressEvent | null;
  result: SyncResult | null;
  isExecuting: boolean;
  onCancel: () => void;
  onClose: () => void;
}

export function SyncProgressModal(props: SyncProgressModalProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const percent = () => {
    if (!props.progress || props.progress.total_bytes === 0) {
      if (props.progress && props.progress.total_items > 0) {
        return Math.min(100, Math.round((props.progress.items_processed / props.progress.total_items) * 100));
      }
      return 0;
    }
    return Math.min(100, Math.round((props.progress.bytes_processed / props.progress.total_bytes) * 100));
  };

  if (!props.isOpen) return null;

  return (
    <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Show
              when={!props.isExecuting}
              fallback={<Loader2 class="animate-spin text-primary" size={24} />}
            >
              <Show
                when={props.result?.success}
                fallback={<AlertTriangle class="text-amber-500" size={24} />}
              >
                <CheckCircle2 class="text-emerald-500" size={24} />
              </Show>
            </Show>
            <div>
              <h3 class="text-sm font-semibold text-foreground">
                {props.isExecuting
                  ? "正在同步文件夹数据..."
                  : props.result?.success
                  ? "文件夹同步成功完成"
                  : "文件夹同步已结束"}
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                {props.progress?.message || "正在处理同步任务"}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar & Metrics */}
        <div class="flex flex-col gap-2 bg-muted/30 p-4 rounded-xl border border-border/50">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-foreground">总体进度</span>
            <span class="font-mono font-semibold text-primary">{percent()}%</span>
          </div>

          <div class="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-200 rounded-full"
              style={{ width: `${percent()}%` }}
            ></div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
            <span>
              已传输:{" "}
              <span class="font-mono font-medium text-foreground">
                {formatBytes(props.progress?.bytes_processed || 0)}
              </span>{" "}
              / {formatBytes(props.progress?.total_bytes || 0)}
            </span>
            <span>
              文件数:{" "}
              <span class="font-mono font-medium text-foreground">
                {props.progress?.items_processed || 0}
              </span>{" "}
              / {props.progress?.total_items || 0}
            </span>
          </div>

          <Show when={props.isExecuting && props.progress && props.progress.speed_bytes_per_sec > 0}>
            <div class="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/30">
              <span>传输速率</span>
              <span class="font-mono text-foreground font-medium">
                {formatBytes(props.progress!.speed_bytes_per_sec)}/s
              </span>
            </div>
          </Show>
        </div>

        {/* Current File */}
        <Show when={props.isExecuting && props.progress?.current_file}>
          <div class="text-xs truncate bg-background border border-border px-3 py-2 rounded-lg text-muted-foreground font-mono">
            <span class="text-foreground font-sans font-medium">当前文件: </span>
            <span class="truncate">{props.progress!.current_file}</span>
          </div>
        </Show>

        {/* Finished Summary telemetry */}
        <Show when={!props.isExecuting && props.result}>
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="bg-secondary/40 p-2.5 rounded-lg border border-border/40">
              <span class="text-muted-foreground block text-[10px]">成功复制</span>
              <span class="font-mono text-sm font-semibold text-foreground">
                {props.result!.files_copied}
              </span>
            </div>
            <div class="bg-secondary/40 p-2.5 rounded-lg border border-border/40">
              <span class="text-muted-foreground block text-[10px]">成功删除</span>
              <span class="font-mono text-sm font-semibold text-foreground">
                {props.result!.files_deleted}
              </span>
            </div>
            <div class="bg-secondary/40 p-2.5 rounded-lg border border-border/40">
              <span class="text-muted-foreground block text-[10px]">耗时</span>
              <span class="font-mono text-sm font-semibold text-foreground">
                {(props.result!.duration_ms / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
        </Show>

        {/* Error notice if any */}
        <Show when={props.result && props.result.errors.length > 0}>
          <div class="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 rounded-lg text-xs max-h-24 overflow-y-auto">
            <div class="font-semibold mb-1">同步异常 ({props.result!.errors.length} 项)</div>
            <ul class="list-disc pl-4 space-y-0.5">
              {props.result!.errors.map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          </div>
        </Show>

        {/* Action Buttons */}
        <div class="flex items-center justify-end gap-3 pt-2">
          <Show
            when={props.isExecuting}
            fallback={
              <button
                onClick={props.onClose}
                class="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-colors"
              >
                完成关闭
              </button>
            }
          >
            <button
              onClick={props.onCancel}
              class="px-4 py-2 bg-secondary hover:bg-destructive hover:text-destructive-foreground text-secondary-foreground rounded-lg text-xs font-medium transition-colors"
            >
              取消同步
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
