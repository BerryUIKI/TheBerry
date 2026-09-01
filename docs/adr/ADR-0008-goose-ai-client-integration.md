# ADR-0008: aaif-goose AI-Client Integration & Drawer UI

## Context
TheBerry desktop application needs native AI assistance capabilities for developers, designers, and operators without compromising on privacy, offline resilience, or user experience. The **aaif-goose/goose** project provides an open-source, local-first AI agent runtime with Model Context Protocol (MCP) and Agent Client Protocol (ACP) support.

Integrating Goose requires:
1. Bidirectional communication between TheBerry host application and the local Goose server process.
2. Robust process lifecycle supervision and dynamic port allocation to eliminate port collisions.
3. Streamed AI responses directly into the UI.
4. A non-obtrusive, slide-out drawer sidebar that can be toggled without cluttering the main workspace.

## Decisions

### 1. Dual-Tier Process Supervisor Architecture
- **Rust Backend Process Manager (`modules::goose::service::GooseProcessManager`)**:
  - Automatically discovers the `goose` binary from system PATH or configured path.
  - Dynamically probes for a free TCP port (binding to ephemeral port `127.0.0.1:0` or sequential scan from base port 3001+) to prevent port conflicts.
  - Spawns `goose serve` / `goose daemon` with custom runtime arguments and health checks (`GET /status` or TCP probe).
  - Automatically terminates child processes on application shutdown or user stop request.
- **Bi-directional Streaming Channel**:
  - Tauri invoke commands initiate queries and session operations.
  - Asynchronous background streaming task consumes SSE/chunked streams and emits Tauri events (`goose://stream-chunk`, `goose://stream-end`, `goose://stream-error`, `goose://status-change`) to the frontend for real-time token rendering.

### 2. Frameless Drawer-Style UI Component
- **Drawer Placement**: Right-hand side overlay/push panel with smooth hardware-accelerated CSS slide-out animation (`transform: translateX`).
- **Zero Interference**: When closed, the drawer is set to `translate-x-full`, `pointer-events-none`, and completely out of the workspace document flow so that clipboard, snippets, file search, and converter modules operate without obstruction.
- **One-Click Toggle**: Accessible via TitleBar Sparkles/Bot button, floating trigger button, or global shortcut (`Ctrl+J` / `Ctrl+Shift+G`).
- **Component Implementations**: Primary native SolidJS component for TheBerry runtime, complemented with React / Tauri portable source deliverables.

### 3. Session Persistence & History
- Session metadata and chat history are optionally cached into TheBerry's embedded `redb` database under table `goose_sessions` and `goose_messages` for instant retrieval across app launches.

## Consequences
- **Positive**:
  - Users gain a powerful AI assistant with local tool execution capabilities.
  - Zero port conflict errors on multi-instance or busy developer machines.
  - Workspace remains uncluttered when the assistant is not in active use.
  - Seamless streaming response output with syntax-highlighted code and tool call visualization.
- **Negative / Considerations**:
  - Requires `goose` binary to be present on the host or guided installation by the user.
  - Memory footprint increases slightly when the Goose daemon child process is active.
