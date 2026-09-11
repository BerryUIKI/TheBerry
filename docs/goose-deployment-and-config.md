# Configuration Checklist & Deployment Notes: aaif-goose

## 1. Runtime Dependencies & Evaluation

### 1.1 Goose CLI / Server Requirements
- **Binary Requirement**: `goose` executable (compatible with AAIF / Block Goose releases).
- **Supported Platforms**: Windows (x86_64/ARM64), macOS (Apple Silicon / Intel), Linux (x86_64).
- **Supported LLM Providers**:
  - Local Models: Ollama, vLLM, LMStudio (requires local endpoint e.g., `http://localhost:11434`).
  - Cloud Providers: OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Groq, OpenRouter, and custom endpoints.
- **Provider API Keys**: Stored securely in the OS Credential Manager (via Windows Credential Manager / `keyring`) and managed directly through TheBerry's AI Assistant settings (`ai_config.json`), without requiring system environment variables.

---

## 2. Configuration Checklist

| Item | Configuration Key | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **Goose Auto-Start** | `goose.auto_start` | `false` | Automatically launch Goose daemon when TheBerry opens. |
| **Binary Path** | `goose.binary_path` | `""` (auto-detect) | Path to custom `goose` / `goose.exe` binary. |
| **Dynamic Port Range** | `goose.port_range` | `[3001, 3050]` | Range of TCP ports to probe for conflict-free binding. |
| **Default Provider** | `goose.default_provider` | `"openai"` | Preferred LLM provider. |
| **Default Model** | `goose.default_model` | `"gpt-4o"` | Preferred LLM model name. |
| **Drawer Default Width** | `goose.drawer_width` | `400` | Initial width of conversation sidebar in pixels. |
| **Close on Escape** | `goose.close_on_escape`| `true` | Allows collapsing the drawer with the `Esc` key. |

---

## 3. Process Management & Conflict Prevention Strategy

```text
TheBerry Launch
      │
      ▼
Check goose.auto_start?
 ├── True  ──► Find open TCP port (e.g. 3022) ──► Spawn `goose serve --port 3022` ──► Health probe OK
 └── False ──► Standby mode (Process spawns on first user drawer prompt or manual Connect click)
```

### Port Conflict Prevention Steps:
1. When starting `goose serve`, Rust probes ports starting from `3001` to `3050`.
2. Socket binding is verified via `std::net::TcpListener::bind("127.0.0.1:<PORT>")`.
3. If an instance is already active on a port, TheBerry tests whether it responds to Goose `/status` endpoint before reusing or picking the next open port.
4. Process termination hook ensures no orphaned child processes remain after TheBerry exits.

---

## 4. Troubleshooting & Deployment Checklist

### Common Issues & Remedies:
- **"Goose binary not found"**:
  - Download Goose CLI from [aaif-goose releases](https://github.com/aaif-goose/goose/releases).
  - Add Goose directory to system `PATH` or specify exact binary path in TheBerry's Settings > AI Assistant panel.
- **"Port Conflict"**:
  - TheBerry's dynamic port allocator automatically selects an alternative open port.
- **"Model API Key Missing"**:
  - Configure your API key directly in TheBerry's AI Assistant settings modal (Settings > AI Assistant or Alt+Space / HUD). Keys are saved securely to Windows Credential Manager.

---

## 5. Provider Presets & Local Ollama Setup

| Provider | Default Base URL | Recommended Models | API Key Env / Header |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini`, `o3-mini` | `Bearer sk-...` |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-3-5-sonnet-20241022` | `x-api-key` |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-1.5-pro`, `gemini-2.0-flash` | `Bearer AIza...` |
| **Ollama (Local)** | `http://localhost:11434/v1` | `llama3.2`, `qwen2.5-coder`, `deepseek-r1` | None required |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat`, `deepseek-reasoner` | `Bearer sk-...` |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `Bearer gsk-...` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `auto`, `anthropic/claude-3.5-sonnet` | `Bearer sk-or-...` |

### Local Ollama Setup:
1. Install Ollama: `https://ollama.com`.
2. Pull model: `ollama run llama3.2` or `ollama run qwen2.5-coder`.
3. In TheBerry AI Settings: select Provider **Ollama (Local)**. Base URL defaults to `http://localhost:11434/v1`.
4. Click Save and chat instantly with zero cloud dependencies or API keys!

