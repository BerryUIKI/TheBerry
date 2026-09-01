# QuickLook Compatibility Risk Assessment

## 1. Executive Summary
This document evaluates technical compatibility risks, platform boundary safety, process sandboxing, and security considerations associated with integrating **QL-Win/QuickLook** into **TheBerry**.

---

## 2. Risk Matrix & Mitigation Strategies

| Risk Category | Identified Risk | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Cross-Platform Safety** | Accidental compilation of Windows APIs on macOS/Linux breaking CI builds. | High | Low | Enforce strict `#[cfg(target_os = "windows")]` conditional compilation blocks with a cross-platform no-op `stub.rs` module. Matrix CI tests on Windows, Ubuntu, and macOS. |
| **Sandbox & Permissions** | Microsoft Store version of QuickLook running in AppContainer may restrict external named pipe creation. | Medium | Medium | Implement dual invocation: primary named pipe connection with automatic fallback to process execution (`QuickLook.exe <file>` or execution alias). |
| **User SID Variation** | In domain-joined or Azure AD environments, SID lookup via simple string parsing could fail. | Medium | Low | Use multi-strategy SID resolution: 1) Windows `GetTokenInformation` API, 2) `whoami /user` execution output, 3) Pipe wildcard probing `QuickLook.App.Pipe.*`. |
| **Privilege Isolation (UIPI)** | Running TheBerry as Admin while QuickLook is standard user blocks pipe IPC. | Low | Low | Detect elevation state and warn user; fallback to CLI launching if pipe access returns `AccessDenied`. |
| **Performance Overhead** | Blocking on named pipe connect during rapid arrow key navigation in search list. | Medium | Low | Non-blocking or short timeout (200-500ms) on named pipe connection. Debounce switch messages if necessary. |

---

## 3. Platform Boundary Verification Checklist

- [x] No Windows-specific imports (`windows`, `winapi`, `named_pipe`) in non-cfg blocks.
- [x] Clean stub module `stub.rs` returning `is_supported_os = false` on Linux and macOS.
- [x] Frontend checks `status.is_supported_os` before showing QuickLook-specific UI elements.
- [x] Zero external binary bundling requirement (uses host's installed QuickLook if present).
