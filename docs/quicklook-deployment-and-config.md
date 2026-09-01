# QuickLook Configuration Checklist & Windows Deployment Notes

## 1. Windows Environment Requirements

### 1.1 Supported Windows Versions
- **Windows 10** (Build 17763 or newer, 64-bit / ARM64).
- **Windows 11** (All builds).

### 1.2 QuickLook Distribution Formats
QuickLook is distributed in multiple formats on Windows:
1. **Microsoft Store (AppX / MSIX)**:
   - Package ID: `25026poiru.QuickLook`
   - Installed path: `C:\Program Files\WindowsApps\25026poiru.QuickLook_*`
   - Automatically initializes named pipe upon background startup.
2. **Standalone MSI Installer / Portable ZIP**:
   - Standard path: `%LOCALAPPDATA%\Programs\QuickLook\QuickLook.exe` or `%PROGRAMFILES%\QuickLook\QuickLook.exe`.
   - Adds execution shortcut to Startup folder or registry run key.

---

## 2. Configuration Checklist

| Configuration Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `quicklook.enabled` | `boolean` | `true` | Enables QuickLook integration on Windows machines. |
| `quicklook.binary_path` | `string` | `""` | Optional manual override path to `QuickLook.exe`. |
| `quicklook.space_preview` | `boolean` | `true` | Allows pressing `Space` in File Search / Spotlight to preview. |
| `quicklook.auto_launch` | `boolean` | `true` | Automatically attempts to launch QuickLook if not running. |

---

## 3. Windows-Specific Deployment & Troubleshooting Notes

### 3.1 Named Pipe Permissions
- The named pipe `\\.\pipe\QuickLook.App.Pipe.<SID>` requires standard user access rights.
- Since TheBerry runs with standard user privileges under the same Windows user session as QuickLook, no UAC elevation is necessary.
- If TheBerry runs elevated (as Administrator) while QuickLook runs as standard user, Windows named pipe access might be blocked by UIPI (User Interface Privilege Isolation). TheBerry should run without administrator elevation for optimal integration.

### 3.2 Troubleshooting Common Issues

| Symptom | Probable Cause | Recommended Fix |
| :--- | :--- | :--- |
| **"QuickLook not running"** | QuickLook application was exited or killed | Launch QuickLook from Start Menu or configure it to run at system startup. |
| **"Pipe not found"** | User SID mismatch or Store sandbox restriction | TheBerry automatically falls back to invoking `QuickLook.exe <path>` CLI. |
| **"Spacebar scrolls search list"** | Default browser/webview space event not prevented | Ensure `e.preventDefault()` is invoked when triggering preview. |
