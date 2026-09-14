import { createSignal, createEffect, Show } from "solid-js";
import { X, QrCode as QrIcon, Download, Copy, Check, Upload, Sparkles, Wifi } from "lucide-solid";
import QRCode from "qrcode";
import { useI18n } from "../../context/I18nContext";
import { useToast } from "../../context/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function QrCodeModal(props: Props) {
  const { language } = useI18n();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = createSignal<"generate" | "scan">("generate");
  const [contentType, setContentType] = createSignal<"text" | "wifi">("text");

  // Text / URL
  const [textContent, setTextContent] = createSignal("https://github.com/BerryUIKI/TheBerry");

  // Wi-Fi
  const [wifiSsid, setWifiSsid] = createSignal("");
  const [wifiPassword, setWifiPassword] = createSignal("");
  const [wifiAuth, setWifiAuth] = createSignal<"WPA" | "WEP" | "nopass">("WPA");
  const [wifiHidden, setWifiHidden] = createSignal(false);

  // QR Display
  const [qrDataUrl, setQrDataUrl] = createSignal("");
  const [errorCorrection, setErrorCorrection] = createSignal<"L" | "M" | "Q" | "H">("M");

  // Scanner
  const [scanResult, setScanResult] = createSignal("");
  const [copied, setCopied] = createSignal(false);

  // Generate QR Code
  createEffect(async () => {
    if (!props.isOpen) return;

    let payload = textContent();
    if (contentType() === "wifi") {
      // Wi-Fi format: WIFI:T:WPA;S:MySSID;P:MyPass;H:false;;
      payload = `WIFI:T:${wifiAuth()};S:${wifiSsid()};P:${wifiPassword()};H:${wifiHidden()};;`;
    }

    if (!payload.trim()) {
      setQrDataUrl("");
      return;
    }

    try {
      const url = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: errorCorrection(),
        margin: 2,
        width: 320,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrDataUrl(url);
    } catch (err: any) {
      console.error("Failed to generate QR code:", err);
    }
  });

  const downloadQr = () => {
    const url = qrDataUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = qrcode_.png;
    a.click();
    success(language() === "zh" ? "二维码图片已保存" : "QR code image saved");
  };

  const copyQrImage = async () => {
    const url = qrDataUrl();
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success(language() === "zh" ? "二维码已复制到剪贴板" : "QR code copied to clipboard");
    } catch {
      toastError(language() === "zh" ? "复制图片失败" : "Failed to copy image");
    }
  };

  // Decode QR using a hidden canvas & jsQR-like image inspection or simple canvas read
  const handleScanImage = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Try scanning with native BarcodeDetector if supported in webview
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          detector
            .detect(img)
            .then((barcodes: any[]) => {
              if (barcodes.length > 0) {
                setScanResult(barcodes[0].rawValue);
                success(language() === "zh" ? "解析二维码成功" : "QR code scanned successfully");
              } else {
                toastError(language() === "zh" ? "未在图片中检测到二维码" : "No QR code detected in image");
              }
            })
            .catch(() => {
              toastError(language() === "zh" ? "二维码检测失败" : "QR code detection failed");
            });
        } else {
          toastError(
            language() === "zh"
              ? "当前系统环境暂不支持原生 BarcodeDetector 扫描"
              : "BarcodeDetector is not supported in current environment"
          );
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div class="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <div class="flex items-center space-x-2.5">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <QrIcon size={20} />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-foreground">
                  {language() === "zh" ? "二维码生成与识别工具" : "QR Code Generator & Scanner"}
                </h3>
                <p class="text-[11px] text-muted-foreground">
                  {language() === "zh"
                    ? "极速本地离线生成文本、网址、Wi-Fi 二维码或识别图片二维码"
                    : "Generate offline QR codes for text, URLs, Wi-Fi or scan from images"}
                </p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div class="flex border-b border-border px-5 bg-card">
            <button
              type="button"
              onClick={() => setActiveTab("generate")}
              class={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab() === "generate"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {language() === "zh" ? "生成二维码" : "Generate QR"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scan")}
              class={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab() === "scan"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {language() === "zh" ? "识别与扫描" : "Scan / Decode"}
            </button>
          </div>

          {/* Body */}
          <div class="p-5 space-y-4 overflow-y-auto flex-1">
            <Show when={activeTab() === "generate"}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Configuration Column */}
                <div class="space-y-3.5">
                  {/* Type Selector */}
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setContentType("text")}
                      class={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                        contentType() === "text"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {language() === "zh" ? "文本 / 网址" : "Text / URL"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentType("wifi")}
                      class={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                        contentType() === "wifi"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      <Wifi size={13} />
                      <span>{language() === "zh" ? "Wi-Fi 接入点" : "Wi-Fi Network"}</span>
                    </button>
                  </div>

                  <Show
                    when={contentType() === "text"}
                    fallback={
                      <div class="space-y-2.5">
                        <div>
                          <label class="block text-[11px] font-medium text-foreground mb-1">
                            {language() === "zh" ? "网络名称 (SSID)" : "Network Name (SSID)"}
                          </label>
                          <input
                            type="text"
                            value={wifiSsid()}
                            onInput={(e) => setWifiSsid(e.currentTarget.value)}
                            placeholder="Office-5G"
                            class="w-full h-8 px-2.5 bg-background border border-input rounded-lg text-xs text-foreground"
                          />
                        </div>
                        <div>
                          <label class="block text-[11px] font-medium text-foreground mb-1">
                            {language() === "zh" ? "Wi-Fi 密码" : "Password"}
                          </label>
                          <input
                            type="password"
                            value={wifiPassword()}
                            onInput={(e) => setWifiPassword(e.currentTarget.value)}
                            placeholder="••••••••"
                            class="w-full h-8 px-2.5 bg-background border border-input rounded-lg text-xs text-foreground"
                          />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                          <div>
                            <label class="block text-[10px] text-muted-foreground mb-1">
                              {language() === "zh" ? "加密类型" : "Security"}
                            </label>
                            <select
                              value={wifiAuth()}
                              onChange={(e) => setWifiAuth(e.currentTarget.value as any)}
                              class="w-full h-7 px-1.5 bg-background border border-input rounded text-xs text-foreground"
                            >
                              <option value="WPA">WPA/WPA2/WPA3</option>
                              <option value="WEP">WEP</option>
                              <option value="nopass">{language() === "zh" ? "无密码 (Open)" : "None"}</option>
                            </select>
                          </div>
                          <div class="flex items-end pb-1.5">
                            <label class="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={wifiHidden()}
                                onChange={(e) => setWifiHidden(e.currentTarget.checked)}
                                class="rounded border-input text-primary w-3.5 h-3.5"
                              />
                              <span>{language() === "zh" ? "隐藏网络" : "Hidden SSID"}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <div>
                      <label class="block text-[11px] font-medium text-foreground mb-1">
                        {language() === "zh" ? "二维码内容" : "Content / Payload"}
                      </label>
                      <textarea
                        rows={5}
                        value={textContent()}
                        onInput={(e) => setTextContent(e.currentTarget.value)}
                        placeholder="https://example.com..."
                        class="w-full p-2.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                      />
                    </div>
                  </Show>

                  {/* Correction Level */}
                  <div>
                    <label class="block text-[10px] text-muted-foreground mb-1">
                      {language() === "zh" ? "纠错级别" : "Error Correction Level"}
                    </label>
                    <div class="flex gap-1.5">
                      {(["L", "M", "Q", "H"] as const).map((level) => (
                        <button
                          type="button"
                          onClick={() => setErrorCorrection(level)}
                          class={`px-2.5 py-0.5 rounded text-xs font-mono font-medium border transition-colors ${
                            errorCorrection() === level
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview Column */}
                <div class="flex flex-col items-center justify-center p-4 bg-muted/20 border border-border rounded-xl space-y-3">
                  <Show
                    when={qrDataUrl()}
                    fallback={
                      <div class="w-48 h-48 border border-dashed border-border rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                        {language() === "zh" ? "输入内容后生成" : "Enter content to preview"}
                      </div>
                    }
                  >
                    <div class="p-2 bg-white rounded-xl shadow-md border border-neutral-200">
                      <img src={qrDataUrl()} alt="QR Code" class="w-48 h-48 block" />
                    </div>
                  </Show>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!qrDataUrl()}
                      onClick={copyQrImage}
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                    >
                      <Show when={copied()} fallback={<Copy size={13} />}>
                        <Check size={13} class="text-emerald-500" />
                      </Show>
                      <span>{copied() ? language() === "zh" ? "已复制" : "Copied" : language() === "zh" ? "复制图片" : "Copy Image"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={!qrDataUrl()}
                      onClick={downloadQr}
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Download size={13} />
                      <span>{language() === "zh" ? "下载 PNG" : "Download PNG"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={activeTab() === "scan"}>
              <div class="space-y-4">
                <label class="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-secondary/20 hover:bg-secondary/40">
                  <Upload size={32} class="text-muted-foreground mb-2" />
                  <span class="text-xs font-semibold text-foreground">
                    {language() === "zh" ? "选取带有二维码的图片" : "Select an image with a QR code"}
                  </span>
                  <span class="text-[11px] text-muted-foreground mt-0.5">
                    {language() === "zh" ? "支持 PNG、JPG、WebP 格式截图与扫描件" : "Supports PNG, JPG, and WebP screenshots or photos"}
                  </span>
                  <input type="file" accept="image/*" onChange={handleScanImage} class="hidden" />
                </label>

                <Show when={scanResult()}>
                  <div class="p-4 bg-secondary/40 border border-border rounded-xl space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles size={14} class="text-primary" />
                        {language() === "zh" ? "解析结果" : "Decoded Result"}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(scanResult());
                          success(language() === "zh" ? "已复制解析内容" : "Copied result");
                        }}
                        class="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy size={12} />
                        {language() === "zh" ? "复制" : "Copy"}
                      </button>
                    </div>
                    <div class="p-2.5 bg-background border border-border rounded-lg text-xs font-mono text-foreground break-all select-all">
                      {scanResult()}
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end">
            <button
              onClick={props.onClose}
              class="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 transition-colors"
            >
              {language() === "zh" ? "关闭" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
