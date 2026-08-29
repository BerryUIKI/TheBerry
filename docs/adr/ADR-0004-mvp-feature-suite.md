# ADR-0004: MVP Feature Suite Architecture & Module Boundaries

## Status
Accepted

## Context
The MVP scope addresses 5 primary high-frequency workflows for developers, designers, and digital operators:
1. Clipboard History Manager
2. Developer Code & Text Snippets Library
3. Application Launcher & Batch Organizer
4. Batch Image Format Converter
5. Everything-like Fast Local File Search

## Decision
1. **Clipboard Module (`modules::clipboard`)**: Implements an OS clipboard polling daemon running on a dedicated OS thread using `arboard`, capturing copied text into `redb` and pushing real-time updates to the UI via Tauri events.
2. **Snippets Module (`modules::snippets`)**: Implements full CRUD with category, language, and tag filtering, syntax storage, and one-click copy.
3. **Launcher Module (`modules::launcher`)**: Supports single executable invocation and sequential/parallel batch shell commands (e.g. multi-instance programs).
4. **Image Converter Module (`modules::image_converter`)**: Leverages the pure-Rust `image` crate for multi-threaded batch format conversion and compression across PNG, JPEG, and WebP.
5. **File Search Module (`modules::file_search`)**: Implements multi-drive scanning, high-speed directory traversal with `walkdir`, category filters, and native Explorer file revealing.

## Consequences
- **Positive**:
  - Clear modular separation of concerns in both `src-tauri/src/modules/` and `src/views/`.
  - No dummy/placeholder tools in MVP; all 5 modules are fully functional.
  - Zero external native C runtime dependencies.
