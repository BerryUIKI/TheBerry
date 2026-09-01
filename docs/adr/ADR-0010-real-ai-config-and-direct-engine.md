# ADR-0010: Real AI Configuration Architecture, Direct LLM Engine & TheBerry Branding

## Context
TheBerry integrates AI conversational assistant capabilities. To provide a complete, non-simulated experience with full user control:
1. Users need a comprehensive configuration interface modeled after the open-source **aaif-goose/goose** specification, supporting all major providers (OpenAI, Anthropic, Google Gemini, Ollama local models, DeepSeek, Groq, OpenRouter, and custom endpoints), parameters, and MCP extensions.
2. The AI execution engine must be capable of genuine, real-time streaming:
   - When the `goose` daemon is active, requests route through Goose's MCP tool environment.
   - When Goose is offline or direct API keys are supplied, TheBerry's Rust backend directly connects to standard LLM SSE endpoints, streaming tokens in real time without fake or hardcoded text.
3. The conversation interface requires consistent visual branding: assistant messages must display the **TheBerry** name and the software's official icon avatar (`/berry.png`).

## Decisions

### 1. Unified AI Configuration Schema (Mirrored from Goose)
We define a persistent configuration structure stored in `config.toml` (and Redb):
- `active_provider`: `openai` | `anthropic` | `gemini` | `ollama` | `deepseek` | `groq` | `openrouter` | `custom`
- `request_format`: `openai` | `anthropic` | `gemini` | `ollama` | `custom` (explicit protocol selection)
- `api_key`: Masked credentials for provider authentication
- `base_url`: Customizable endpoint URL with smart deduplication (e.g. `http://localhost:11434/v1`, `https://api.openai.com/v1`, `https://api.deepseek.com/v1`)
- `model`: Selected LLM model identifier (e.g. `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`, `llama3.2`, `deepseek-chat`)
- `temperature` & `max_tokens`: Generation hyper-parameters
- `system_prompt`: Custom persona and instructions
- `extensions`: MCP tool extensions and custom server configurations

### 2. Dual-Engine Dispatcher & Multi-Protocol Resolution in Rust Backend
In `src-tauri/src/modules/goose/service.rs`:
- **Smart URL Deduplication**: Checks whether `base_url` already contains endpoints like `/chat/completions`, `/messages`, `/api/chat`, or `:generateContent` / `:streamGenerateContent` to completely eliminate duplicate path segments and 404 errors.
- **Multi-Protocol Handlers**:
  - `openai`: POST `/chat/completions` with Bearer auth and `choices[0].delta.content` SSE parser.
  - `anthropic`: POST `/v1/messages` with `x-api-key` and `content_block_delta` SSE parser.
  - `gemini`: POST `:streamGenerateContent?alt=sse` or `:generateContent` with `X-goog-api-key` header and query key fallback, using recursive JSON extraction to parse `candidates[0].content.parts[0].text` without raw JSON leakage.
  - `ollama`: POST `/api/chat` with NDJSON streaming reader.
  - `custom`: Direct POST to exact user-defined URL.
- If `GooseProcessManager` is actively running, requests route through Goose's MCP server.
- Real tokens are streamed chunk-by-chunk via Tauri's `goose://stream-chunk` event bus.

### 3. Assistant Avatar, Non-Colliding Layout & Language Integrity
- Assistant messages display the app icon `/berry.png` with a rounded-full border.
- Assistant title is strictly **TheBerry**.
- User messages display user indicator **You**.
- **UI Layout & Word Wrapping**: Chat bubbles feature `min-w-0`, `break-words`, `break-all`, and inline action controls preventing element stacking or horizontal overflow.
- **Language Consistency**: The user interface strictly adheres to the active application language (English) with no mixed or stray untranslated labels.

## Consequences
- **Positive**:
  - Zero "fake" responses; real streaming token delivery for any configured API key or local Ollama instance.
  - Complete parity with Goose provider settings and flexibility for local privacy-conscious users (Ollama).
  - Clean, polished application identity with the software icon avatar.
- **Negative / Considerations**:
  - API keys must be securely persisted in local configuration.
