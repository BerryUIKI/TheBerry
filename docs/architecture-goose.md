# Architecture Design Document: aaif-goose AI Client Integration

## 1. Executive Summary
This document specifies the technical architecture for integrating the **aaif-goose** AI client runtime into **TheBerry** desktop application. The integration enables in-app conversational AI, streaming responses, MCP tool execution, and local-first workflow automation through a drawer-style sliding sidebar panel.

---

## 2. System Architecture

```mermaid
graph TD
    subgraph UI ["Frontend (SolidJS / React UI)"]
        TitleBar["TitleBar (AI Drawer Toggle)"]
        Drawer["Drawer Sidebar (Right-side slide-out)"]
        ChatStream["Chat Stream UI (Markdown + Code Copy + Status)"]
        GooseService["Goose Frontend Service Layer"]
    end

    subgraph TauriBridge ["Tauri v2 IPC & Event Streaming"]
        InvokeCmds["Tauri Commands (start, stop, query, status)"]
        EventStream["Tauri Event Channel (goose://stream-chunk)"]
    end

    subgraph RustBackend ["Rust Backend (TheBerry Core)"]
        GooseMod["modules::goose"]
        ProcessMgr["GooseProcessManager (Child Supervisor)"]
        PortAllocator["Dynamic Port Finder (Ephemeral 0 / Port Range)"]
        HttpStream["Reqwest Async SSE Stream Consumer"]
        RedbStorage["redb (Embedded Key-Value & Session Storage)"]
    end

    subgraph LocalDaemon ["Local aaif-goose Daemon"]
        GooseServer["goose serve / daemon (:PORT)"]
        MCPTools["MCP Tools (Filesystem, Shell, APIs)"]
        LLMs["Configured LLMs (Anthropic, OpenAI, Ollama, etc.)"]
    end

    TitleBar -->|Toggle Click| Drawer
    Drawer --> ChatStream
    ChatStream --> GooseService
    GooseService -->|Invoke| InvokeCmds
    InvokeCmds --> GooseMod
    GooseMod --> ProcessMgr
    ProcessMgr --> PortAllocator
    ProcessMgr -->|Spawn / Monitor / Terminate| GooseServer
    GooseMod --> HttpStream
    HttpStream -->|HTTP POST /sessions/{id}/messages| GooseServer
    GooseServer --> MCPTools
    GooseServer --> LLMs
    GooseServer -->|SSE Stream Response| HttpStream
    HttpStream -->|Emit Events| EventStream
    EventStream -->|Listen| GooseService
    GooseMod --> RedbStorage
```

---

## 3. Component Breakdown

### 3.1 Process Management & Conflict Prevention
1. **Dynamic Port Discovery**:
   - Fixed ports (like `3000` or `8080`) frequently conflict with other developer tools.
   - `GooseProcessManager` creates a temporary TCP listener on `127.0.0.1:0` to retrieve an OS-assigned ephemeral open port, or iterates through ports `3001..3050` checking socket availability before starting `goose serve`.
2. **Binary Resolution Strategy**:
   - `PATH` lookup for `goose` / `goose.exe`.
   - OS-specific standard binary paths (`~/.cargo/bin`, `~/.local/bin`, `%LOCALAPPDATA%\Programs\goose`).
   - Explicit user overrides in `config.toml` (`goose.binary_path`).
3. **Supervisor & Child Lifecycle**:
   - Started in hidden process mode (`CREATE_NO_WINDOW` on Windows).
   - Health check probe with exponential backoff on `http://127.0.0.1:<PORT>/status` or TCP ping.
   - Process termination hooks on application exit (`Drop` handler / `SIGTERM` / `kill`).

### 3.2 Bidirectional Communication Protocol
- **Client to Backend**: Tauri Invoke API with typed payloads (`SendGooseMessagePayload`).
- **Backend to Goose Server**: HTTP POST `/sessions/{session_id}/messages` requesting `text/event-stream`.
- **Stream Forwarding**: Tokio async streaming reader parsing SSE lines (`data: {...}`) and emitting `goose://stream-chunk` directly to the active Tauri webview window.
- **Event Schema**:
  ```typescript
  interface GooseStreamChunk {
    sessionId: string;
    messageId: string;
    delta: string;
    isFinished: boolean;
    error?: string;
  }
  ```

### 3.3 Drawer-Style Sidebar Specification
- **Position**: Pinned to the right viewport edge.
- **Animation**: CSS hardware-accelerated translation:
  - Open: `transform: translateX(0); opacity: 1; pointer-events: auto;`
  - Closed: `transform: translateX(100%); opacity: 0; pointer-events: none;`
- **Workspace Isolation**: When closed, the drawer takes up zero layout space and does not block clicks on any underlying tools (Clipboard, Snippets, Launcher, File Search).
- **Responsive Sizing**: Default width `400px` (min `320px`, max `600px`).

---

## 4. State Management & Storage
- `AppState` manages `Arc<GooseService>` and `Arc<GooseProcessManager>`.
- Session list and cached chat history are optionally indexed in `redb` (`goose_sessions` table) to maintain instant offline availability.

---

## 5. Real AI Configuration & Direct LLM Engine

### 5.1 Configuration Schema (Goose Model Parity)
TheBerry provides full parity with `aaif-goose/goose` configuration options:
- **Providers**: OpenAI, Anthropic Claude, Google Gemini, Ollama (Local), DeepSeek, Groq, OpenRouter, Custom Endpoints.
- **Credentials & Routing**: `api_key`, `base_url`, `model`.
- **Generation Parameters**: `temperature`, `max_tokens`, `system_prompt`.
- **Extensions / MCP Tools**: Developer tools (file edits, shell commands, directory indexing), Web search/fetch, Custom STDIO/SSE MCP servers.

### 5.2 Dual Execution Dispatcher
- **Tier 1 (Goose Daemon)**: If the Goose daemon is active, prompts are routed to the local Goose server to leverage its full MCP agentic toolchain.
- **Tier 2 (Direct LLM Streaming)**: If Goose is not running, TheBerry's native Rust streaming client connects directly to standard `/chat/completions` endpoints via `reqwest`, streaming SSE delta tokens continuously to the chat UI. Zero simulated or hardcoded text is returned.

---

## 6. Avatar Branding & Identity
- **Assistant Identity**: **TheBerry**
- **Assistant Avatar**: App icon `/berry.png` with rounded-full border.
- **User Identity**: **You** with user avatar.

