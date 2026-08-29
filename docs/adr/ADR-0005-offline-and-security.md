# ADR-0005: Security Policy, Offline Operation, and Privacy Guarantees

## Status
Accepted

## Context
Personal utility software often handles sensitive user data, including copied clipboard passwords, source code snippets, proprietary images, and file directories. Complete user privacy and offline security are non-negotiable requirements.

## Decision
1. **Offline by Default**: All utility operations (clipboard tracking, snippets storage, file searching, image conversion, application launching) execute 100% locally on the user's hardware.
2. **Zero Unprompted Network Access**: No analytics, telemetry, or remote inference APIs are invoked during normal production execution.
3. **Explicit User-Initiated Network Access Only**: Network access is permitted exclusively for explicit user-requested operations (such as application updates or optional model downloads in future releases).
4. **Tauri Capabilities**: Security permissions in `src-tauri/capabilities/default.json` restrict webview capabilities strictly to necessary window operations, system dialogs, and opener APIs.

## Consequences
- **Positive**:
  - Uncompromised privacy; zero risk of clipboard or code leakage over the network.
  - Consistent operation in air-gapped or offline development environments.
- **Negative**:
  - Remote cloud synchronization is explicitly out of scope for MVP.
