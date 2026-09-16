import { createSignal, For, Show } from "solid-js";
import { Bookmark, Plus, Trash2, X, Play, Activity } from "lucide-solid";
import { SyncProfile } from "../../types/folder_sync";
import { folderSyncDeleteProfile, folderSyncToggleRealtime } from "../../services/folderSync";
import { useToast } from "../../context/ToastContext";
import { useI18n } from "../../context/I18nContext";

interface SavedProfilesModalProps {
  isOpen: boolean;
  profiles: SyncProfile[];
  onSelectProfile: (profile: SyncProfile) => void;
  onSaveCurrentAsProfile: (name: string) => void;
  onRefreshProfiles: () => void;
  onClose: () => void;
}

export function SavedProfilesModal(props: SavedProfilesModalProps) {
  const { language } = useI18n();
  const { success, error } = useToast();
  const [newProfileName, setNewProfileName] = createSignal("");
  const [isAdding, setIsAdding] = createSignal(false);

  const handleSave = () => {
    const name = newProfileName().trim();
    if (!name) return;
    props.onSaveCurrentAsProfile(name);
    setNewProfileName("");
    setIsAdding(false);
  };

  const handleDelete = async (profileId: string) => {
    try {
      await folderSyncDeleteProfile(profileId);
      success(
        language() === "zh" ? "删除成功" : "Deleted successfully",
        language() === "zh" ? "任务方案已删除" : "Sync profile deleted"
      );
      props.onRefreshProfiles();
    } catch (e) {
      error(language() === "zh" ? "删除失败" : "Failed to delete", String(e));
    }
  };

  const handleToggleRealtime = async (profile: SyncProfile) => {
    try {
      const nextState = !profile.realtime_enabled;
      await folderSyncToggleRealtime(profile.id, nextState);
      success(
        nextState
          ? language() === "zh" ? "RealTimeSync 开启" : "RealTimeSync Enabled"
          : language() === "zh" ? "RealTimeSync 已停用" : "RealTimeSync Disabled",
        nextState
          ? language() === "zh" ? `正在实时监控: ${profile.left_path}` : `Monitoring: ${profile.left_path}`
          : language() === "zh" ? "已停止实时变动监听" : "Real-time monitoring stopped"
      );
      props.onRefreshProfiles();
    } catch (e) {
      error(language() === "zh" ? "操作失败" : "Operation failed", String(e));
    }
  };

  if (!props.isOpen) return null;

  return (
    <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <Bookmark size={18} class="text-primary" />
            <h3 class="text-sm font-semibold text-foreground">
              {language() === "zh" ? "同步任务配置方案" : "Sync Task Profiles"}
            </h3>
          </div>
          <button
            onClick={props.onClose}
            class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Add current configuration bar */}
        <Show
          when={isAdding()}
          fallback={
            <button
              onClick={() => setIsAdding(true)}
              class="flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Plus size={14} />
              <span>
                {language() === "zh"
                  ? "将当前文件夹对与同步参数保存为新方案"
                  : "Save current folder pair and sync settings as new profile"}
              </span>
            </button>
          }
        >
          <div class="flex items-center gap-2 bg-muted/40 p-3 rounded-xl border border-border">
            <input
              type="text"
              placeholder={
                language() === "zh"
                  ? "请输入方案名称 (例如: 工作文件备份到NAS)"
                  : "Enter profile name (e.g. Work files to NAS)"
              }
              value={newProfileName()}
              onInput={(e) => setNewProfileName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              class="flex-1 bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSave}
              class="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-colors"
            >
              {language() === "zh" ? "保存" : "Save"}
            </button>
            <button
              onClick={() => setIsAdding(false)}
              class="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors"
            >
              {language() === "zh" ? "取消" : "Cancel"}
            </button>
          </div>
        </Show>

        {/* Profile list */}
        <div class="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          <Show
            when={props.profiles.length > 0}
            fallback={
              <div class="text-center py-8 text-xs text-muted-foreground">
                {language() === "zh"
                  ? "暂无保存的任务方案。可将当前配置点击上方按钮添加为快速方案。"
                  : "No saved sync profiles yet. Click the button above to add current settings."}
              </div>
            }
          >
            <For each={props.profiles}>
              {(profile) => (
                <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 border border-border/60 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-xs text-foreground truncate">
                        {profile.name}
                      </span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                        {profile.sync_variant}
                      </span>
                      {profile.realtime_enabled && (
                        <span class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 font-medium animate-pulse">
                          <Activity size={10} />
                          <span>{language() === "zh" ? "监控中" : "Monitoring"}</span>
                        </span>
                      )}
                    </div>
                    <div class="text-[11px] text-muted-foreground truncate mt-1 font-mono">
                      <span>{profile.left_path}</span>
                      <span class="mx-1 text-primary">➔</span>
                      <span>{profile.right_path}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    {/* Toggle RealTimeSync */}
                    <button
                      onClick={() => handleToggleRealtime(profile)}
                      class={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        profile.realtime_enabled
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                          : "bg-background text-muted-foreground border-border hover:text-foreground"
                      }`}
                      title={
                        profile.realtime_enabled
                          ? language() === "zh" ? "停止实时变动监控" : "Stop RealTimeSync"
                          : language() === "zh" ? "开启 RealTimeSync 自动监控" : "Enable RealTimeSync"
                      }
                    >
                      <Activity size={13} />
                    </button>

                    {/* Load */}
                    <button
                      onClick={() => {
                        props.onSelectProfile(profile);
                        props.onClose();
                      }}
                      class="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-colors"
                      title={language() === "zh" ? "载入此方案配置" : "Load profile settings"}
                    >
                      {language() === "zh" ? "载入" : "Load"}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(profile.id)}
                      class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title={language() === "zh" ? "删除方案" : "Delete profile"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-end border-t border-border pt-3 mt-1">
          <button
            onClick={props.onClose}
            class="px-4 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors"
          >
            {language() === "zh" ? "关闭" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
