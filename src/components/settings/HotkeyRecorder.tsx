import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Keyboard, RotateCcw, AlertCircle } from "lucide-solid";
import { useI18n } from "../../context/I18nContext";

interface HotkeyRecorderProps {
  currentShortcut: string;
  onSave: (newShortcut: string) => Promise<void>;
  defaultShortcut?: string;
}

export function HotkeyRecorder(props: HotkeyRecorderProps) {
  const { t } = useI18n();
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordedKeys, setRecordedKeys] = createSignal<string[]>([]);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const defaultKey = () => props.defaultShortcut || "Alt+Space";

  const formatKeyName = (key: string, code: string): string => {
    if (code.startsWith("Key")) return code.replace("Key", "").toUpperCase();
    if (code.startsWith("Digit")) return code.replace("Digit", "");
    if (code === "Space") return "Space";
    if (code.startsWith("Numpad")) return code;
    if (code.startsWith("F") && !isNaN(Number(code.substring(1)))) return code;
    if (code === "Backquote") return "`";
    if (code === "Minus") return "-";
    if (code === "Equal") return "=";
    if (code === "BracketLeft") return "[";
    if (code === "BracketRight") return "]";
    if (code === "Backslash") return "\\";
    if (code === "Semicolon") return ";";
    if (code === "Quote") return "'";
    if (code === "Comma") return ",";
    if (code === "Period") return ".";
    if (code === "Slash") return "/";
    if (["Tab", "Enter", "Backspace", "Delete", "Insert", "Home", "End", "PageUp", "PageDown"].includes(key)) return key;
    return key.length === 1 ? key.toUpperCase() : key;
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!isRecording()) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      setIsRecording(false);
      setRecordedKeys([]);
      setErrorMessage(null);
      return;
    }

    const isModifierOnly = ["Control", "Alt", "Shift", "Meta"].includes(e.key);

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Super");

    if (isModifierOnly) {
      setRecordedKeys(parts);
      return;
    }

    // A non-modifier key was pressed
    const keyName = formatKeyName(e.key, e.code);
    if (!parts.includes(keyName)) {
      parts.push(keyName);
    }

    setRecordedKeys(parts);

    // Validate that at least one modifier key is present
    const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
    if (!hasModifier) {
      setErrorMessage(t("settings.hotkey_need_modifier") || "Please include at least one modifier (Ctrl, Alt, or Shift)");
      return;
    }

    const shortcutString = parts.join("+");
    setIsRecording(false);
    setErrorMessage(null);

    // Save shortcut
    try {
      setIsSaving(true);
      await props.onSave(shortcutString);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to bind shortcut");
    } finally {
      setIsSaving(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleResetToDefault = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await props.onSave(defaultKey());
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to reset shortcut");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="flex flex-col space-y-1">
      <div class="flex items-center space-x-2">
        {/* Hotkey Display / Recording Button */}
        <button
          type="button"
          disabled={isSaving()}
          onClick={() => {
            setErrorMessage(null);
            setRecordedKeys([]);
            setIsRecording((prev) => !prev);
          }}
          class={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold flex items-center space-x-1.5 border transition-all shadow-xs ${
            isRecording()
              ? "bg-primary/20 border-primary text-primary animate-pulse ring-2 ring-primary/30"
              : "bg-secondary hover:bg-secondary/80 text-foreground border-border"
          }`}
          title={isRecording() ? "Press your desired key combination, or Esc to cancel" : "Click to record new shortcut"}
        >
          <Keyboard size={12} class={isRecording() ? "text-primary animate-bounce" : "text-muted-foreground"} />
          <span>
            {isRecording()
              ? recordedKeys().length > 0
                ? recordedKeys().join("+") + "..."
                : t("settings.recording_hotkey") || "Press keys (Esc to cancel)..."
              : props.currentShortcut || defaultKey()}
          </span>
        </button>

        {/* Reset Button */}
        <Show when={props.currentShortcut !== defaultKey()}>
          <button
            type="button"
            disabled={isSaving()}
            onClick={handleResetToDefault}
            title={t("settings.reset_default_hotkey") || "Reset to default (Alt+Space)"}
            class="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCcw size={12} />
          </button>
        </Show>
      </div>

      <Show when={errorMessage()}>
        <span class="text-[10px] text-destructive flex items-center space-x-1">
          <AlertCircle size={10} />
          <span>{errorMessage()}</span>
        </span>
      </Show>
    </div>
  );
}
