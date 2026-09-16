use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordConvertTask {
    pub source_path: String,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordConvertResult {
    pub source_path: String,
    pub output_path: String,
    pub success: bool,
    pub error_message: Option<String>,
}

pub fn convert_word_to_pdf_single(task: &WordConvertTask) -> WordConvertResult {
    let source = Path::new(&task.source_path);
    if !source.exists() {
        return WordConvertResult {
            source_path: task.source_path.clone(),
            output_path: String::new(),
            success: false,
            error_message: Some(format!("Source document not found: {}", task.source_path)),
        };
    }

    let target_pdf = match &task.output_path {
        Some(p) => PathBuf::from(p),
        None => source.with_extension("pdf"),
    };

    let target_pdf_str = target_pdf.to_string_lossy().to_string();

    // 1. Try PowerShell Word.Application COM automation
    let ps_script = r#"
param([string]$DocPath, [string]$PdfPath)
$ErrorActionPreference = 'Stop'

try {
    # 1. Try Microsoft Office Word COM
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open($DocPath, $false, $true) # ReadOnly
    # 17 = wdFormatPDF
    $doc.SaveAs([ref]$PdfPath, [ref]17)
    $doc.Close([ref]$false)
    $word.Quit()
    Write-Output "SUCCESS"
    exit 0
} catch {
    $wordError = $_.Exception.Message
}

try {
    # 2. Try WPS Office Writer COM
    $wps = New-Object -ComObject kwps.application -ErrorAction SilentlyContinue
    if (-not $wps) {
        $wps = New-Object -ComObject wps.application
    }
    $wps.Visible = $false
    $doc = $wps.Documents.Open($DocPath, $false, $true)
    $doc.SaveAs([ref]$PdfPath, [ref]17)
    $doc.Close([ref]$false)
    $wps.Quit()
    Write-Output "SUCCESS"
    exit 0
} catch {
    $wpsError = $_.Exception.Message
}

throw "Neither Microsoft Word nor WPS Office is installed or able to convert. Word error: $wordError; WPS error: $wpsError"
"#;

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        ps_script,
        "-DocPath",
        &task.source_path,
        "-PdfPath",
        &target_pdf_str,
    ]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.output() {
        Ok(output) => {
            if output.status.success() && target_pdf.exists() {
                WordConvertResult {
                    source_path: task.source_path.clone(),
                    output_path: target_pdf_str,
                    success: true,
                    error_message: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let msg = if !stderr.is_empty() {
                    stderr.to_string()
                } else {
                    stdout.to_string()
                };

                WordConvertResult {
                    source_path: task.source_path.clone(),
                    output_path: String::new(),
                    success: false,
                    error_message: Some(msg.trim().to_string()),
                }
            }
        }
        Err(e) => WordConvertResult {
            source_path: task.source_path.clone(),
            output_path: String::new(),
            success: false,
            error_message: Some(format!("Failed to launch conversion process: {}", e)),
        },
    }
}
