use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub text: String,
    pub lines: Vec<String>,
    pub language: String,
    pub success: bool,
    pub error_message: Option<String>,
}

pub fn execute_windows_ocr(image_path: &str, lang_hint: Option<String>) -> Result<OcrResult, String> {
    let path = Path::new(image_path);
    if !path.exists() {
        return Err(format!("Image file not found: {}", image_path));
    }

    // Windows PowerShell script utilizing Windows.Media.Ocr.OcrEngine
    let ps_script = r#"
param([string]$ImagePath, [string]$LangHint)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

function AwaitOperation($op, $type) {
    $m = $asTaskGeneric.MakeGenericMethod($type)
    $task = $m.Invoke($null, @($op))
    $task.Wait()
    return $task.Result
}

[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)
$file = AwaitOperation $fileOp ([Windows.Storage.StorageFile])

$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$stream = AwaitOperation $streamOp ([Windows.Storage.Streams.IRandomAccessStream])

$decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoder = AwaitOperation $decoderOp ([Windows.Graphics.Imaging.BitmapDecoder])

$bitmapOp = $decoder.GetSoftwareBitmapAsync()
$bitmap = AwaitOperation $bitmapOp ([Windows.Graphics.Imaging.SoftwareBitmap])

$engine = $null
if ($LangHint -and [Windows.Globalization.Language]::IsWellFormedLanguageTag($LangHint)) {
    $lang = [Windows.Globalization.Language]::new($LangHint)
    if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }
}

if (-not $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}

if (-not $engine) {
    throw "No compatible OCR language engine available on this Windows system."
}

$ocrOp = $engine.RecognizeAsync($bitmap)
$result = AwaitOperation $ocrOp ([Windows.Media.Ocr.OcrResult])

$lines = @()
foreach ($l in $result.Lines) {
    $lines += $l.Text
}

$output = @{
    text = $result.Text
    lines = $lines
    language = $engine.RecognizerLanguage.LanguageTag
}

$output | ConvertTo-Json -Depth 3 -Compress
"#;

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        ps_script,
        "-ImagePath",
        image_path,
        "-LangHint",
        &lang_hint.unwrap_or_default(),
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output().map_err(|e| format!("Failed to spawn PowerShell for OCR: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("OCR execution error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();

    #[derive(Deserialize)]
    struct RawPsOcr {
        text: Option<String>,
        lines: Option<serde_json::Value>,
        language: Option<String>,
    }

    if let Ok(parsed) = serde_json::from_str::<RawPsOcr>(trimmed) {
        let lines_vec = match parsed.lines {
            Some(serde_json::Value::Array(arr)) => arr.into_iter().filter_map(|v| v.as_str().map(String::from)).collect(),
            Some(serde_json::Value::String(s)) => vec![s],
            _ => Vec::new(),
        };

        Ok(OcrResult {
            text: parsed.text.unwrap_or_default(),
            lines: lines_vec,
            language: parsed.language.unwrap_or_else(|| "unknown".to_string()),
            success: true,
            error_message: None,
        })
    } else {
        // Fallback raw text if json parsing failed
        Ok(OcrResult {
            text: trimmed.to_string(),
            lines: trimmed.lines().map(String::from).collect(),
            language: "auto".to_string(),
            success: true,
            error_message: None,
        })
    }
}
