# API Invocation Examples & Protocol Specifications

## 1. Overview
This document describes the IPC API commands, event contracts, and HTTP/SSE wire formats used for communication between TheBerry frontend, the Rust host backend, and the local Goose daemon.

---

## 2. Tauri IPC Commands

### 2.1 Process Management

#### `get_goose_status`
Retrieves current Goose daemon status, detected port, and runtime metadata.

- **Frontend Invoke**:
  ```typescript
  const status: GooseStatus = await invoke("get_goose_status");
  ```
- **Response Schema**:
  ```typescript
  interface GooseStatus {
    is_running: boolean;
    is_installed: boolean;
    binary_path: string | null;
    port: number | null;
    active_model: string | null;
    active_provider: string | null;
    error_message: string | null;
  }
  ```

#### `start_goose_daemon`
Spawns the local Goose server process on an automatically allocated free port.

- **Frontend Invoke**:
  ```typescript
  const status: GooseStatus = await invoke("start_goose_daemon", {
    customPort: null, // optional port override, null for dynamic allocation
  });
  ```

#### `stop_goose_daemon`
Terminates the active Goose server process.

- **Frontend Invoke**:
  ```typescript
  await invoke("stop_goose_daemon");
  ```

---

### 2.2 Messaging & Streaming

#### `send_goose_message`
Sends a prompt to the active Goose session and initiates streaming.

- **Payload**:
  ```typescript
  interface SendGooseMessagePayload {
    session_id: string;
    prompt: string;
    model?: string;
    provider?: string;
  }
  ```
- **Frontend Invoke**:
  ```typescript
  const response = await invoke("send_goose_message", {
    payload: {
      session_id: "sess_123456",
      prompt: "Explain how to write a custom Tauri plugin in Rust",
    }
  });
  ```

---

## 3. Streaming Event Channels

The backend emits events over Tauri's event bus while consuming Server-Sent Events (SSE) from the Goose server:

### Event: `goose://stream-chunk`
- **Payload**:
  ```json
  {
    "session_id": "sess_123456",
    "message_id": "msg_789012",
    "delta": "To write a custom Tauri plugin...",
    "is_finished": false
  }
  ```

### Event: `goose://stream-end`
- **Payload**:
  ```json
  {
    "session_id": "sess_123456",
    "message_id": "msg_789012",
    "is_finished": true
  }
  ```

### Event: `goose://status-change`
- Emitted whenever the daemon starts, stops, or experiences an error.

---

## 4. Frontend Service Subscription Example (TypeScript)

```typescript
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { GooseStatus, GooseStreamChunk } from "../types/goose";

export class GooseService {
  static async getStatus(): Promise<GooseStatus> {
    return await invoke<GooseStatus>("get_goose_status");
  }

  static async startDaemon(): Promise<GooseStatus> {
    return await invoke<GooseStatus>("start_goose_daemon");
  }

  static async stopDaemon(): Promise<void> {
    await invoke("stop_goose_daemon");
  }

  static async sendMessage(sessionId: string, prompt: string): Promise<void> {
    await invoke("send_goose_message", {
      payload: {
        session_id: sessionId,
        prompt,
      },
    });
  }

  static async onStreamChunk(callback: (chunk: GooseStreamChunk) => void) {
    return await listen<GooseStreamChunk>("goose://stream-chunk", (event) => {
      callback(event.payload);
    });
  }
}
```
