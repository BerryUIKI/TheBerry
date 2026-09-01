use the_berry_lib::modules::quicklook::types::QuickLookPreviewPayload;

#[cfg(target_os = "windows")]
use the_berry_lib::modules::quicklook::windows::QuickLookService;

#[cfg(not(target_os = "windows"))]
use the_berry_lib::modules::quicklook::stub::QuickLookService;

#[test]
fn test_quicklook_status_query() {
    let status = QuickLookService::get_status();
    #[cfg(target_os = "windows")]
    {
        assert!(status.is_supported_os, "Should be supported OS on Windows");
        if let Some(pipe) = status.pipe_name {
            assert!(pipe.starts_with(r"\\.\pipe\QuickLook.App.Pipe."));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        assert!(!status.is_supported_os, "Should NOT be supported OS on non-Windows");
        assert!(!status.is_running);
    }
}

#[test]
fn test_quicklook_preview_nonexistent_file_rejected() {
    let payload = QuickLookPreviewPayload {
        path: "C:\\non_existent_file_xyz_123456789.dat".to_string(),
        mode: Some("toggle".to_string()),
    };

    let result = QuickLookService::preview(payload);
    assert!(result.is_err(), "Non-existent file preview should return Err");
}
