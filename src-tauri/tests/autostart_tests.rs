use the_berry_lib::modules::autostart::service::AutostartService;

#[test]
fn test_autostart_enable_query_disable_lifecycle() {
    // Check initial status
    let initial_result = AutostartService::is_enabled();
    assert!(initial_result.is_ok(), "is_enabled query must return Ok(bool)");

    // Test enable with a mock target binary path
    let mock_exe = if cfg!(windows) {
        r"C:\Program Files\TheBerry\the-berry.exe"
    } else {
        "/usr/local/bin/the-berry"
    };

    let enable_res = AutostartService::enable(Some(mock_exe));
    assert!(enable_res.is_ok(), "AutostartService::enable should succeed: {:?}", enable_res.err());

    // Verify it is now enabled
    let is_enabled = AutostartService::is_enabled().unwrap();
    assert!(is_enabled, "is_enabled should be true after enable()");

    // Test disable
    let disable_res = AutostartService::disable();
    assert!(disable_res.is_ok(), "AutostartService::disable should succeed: {:?}", disable_res.err());

    // Verify it is now disabled
    let is_disabled = AutostartService::is_enabled().unwrap();
    assert!(!is_disabled, "is_enabled should be false after disable()");
}
