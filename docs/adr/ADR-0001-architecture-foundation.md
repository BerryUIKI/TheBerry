# ADR-0001: Architecture Foundation: Tauri v2 Backend & SolidJS Frontend

## Status
Accepted

## Context
TheBerry is designed as a lightweight, resource-efficient personal desktop utility suite for developers, designers, and content creators. The application requires high native performance, low memory usage, responsive UI rendering, and deep OS integration (system tray, file search, native process invocation, and system clipboard monitoring).

## Decision
1. **Desktop Shell & Backend**: We adopt **Rust with Tauri v2**. Tauri provides native webview bindings, low memory footprint (~30-50MB RAM compared to 200MB+ for Electron), high execution safety, and modular plugin/capability security.
2. **Frontend Architecture**: We adopt **SolidJS + TypeScript + Vite + Tailwind CSS**. SolidJS offers fine-grained reactivity with direct DOM updates without Virtual DOM overhead, matching the high-efficiency design goals.
3. **IPC Topology**: Tauri's asynchronous and synchronous `invoke` commands serve as strongly typed RPC endpoints connecting frontend TypeScript services to backend Rust modules.

## Consequences
- **Positive**:
  - Extremely fast application startup and minimal memory footprint.
  - Type-safe backend command architecture with clean separation of concerns.
  - Modern utility styling via Tailwind CSS and fine-grained reactivity via SolidJS.
- **Negative**:
  - Developers need familiarity with both Rust and SolidJS ecosystems.
