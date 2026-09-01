import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  getGooseStatus, 
  startGooseDaemon, 
  stopGooseDaemon, 
  sendGooseMessage, 
  setGooseCustomBinaryPath 
} from "../services/goose";
import { GooseStatus } from "../types/goose";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { invoke } from "@tauri-apps/api/core";

describe("Goose AI Service & Types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves Goose daemon status accurately", async () => {
    const mockStatus: GooseStatus = {
      is_running: true,
      is_installed: true,
      binary_path: "/usr/local/bin/goose",
      port: 3025,
      active_model: "gpt-4o",
      active_provider: "openai",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(mockStatus);

    const status = await getGooseStatus();
    expect(status).toEqual(mockStatus);
    expect(invoke).toHaveBeenCalledWith("get_goose_status", undefined);
  });

  it("starts Goose daemon with dynamic port allocation", async () => {
    const mockStarted: GooseStatus = {
      is_running: true,
      is_installed: true,
      binary_path: "C:\\Users\\User\\.cargo\\bin\\goose.exe",
      port: 3005,
      active_model: "gpt-4o",
      active_provider: "openai",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(mockStarted);

    const status = await startGooseDaemon();
    expect(status.is_running).toBe(true);
    expect(status.port).toBe(3005);
    expect(invoke).toHaveBeenCalledWith("start_goose_daemon", { customPort: null });
  });

  it("stops Goose daemon correctly", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await stopGooseDaemon();
    expect(invoke).toHaveBeenCalledWith("stop_goose_daemon", undefined);
  });

  it("sends prompt message to Goose", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    const payload = {
      session_id: "test-session",
      prompt: "Refactor this snippet",
      model: "gpt-4o",
    };

    await sendGooseMessage(payload);
    expect(invoke).toHaveBeenCalledWith("send_goose_message", { payload });
  });

  it("updates custom binary path", async () => {
    const updatedStatus: GooseStatus = {
      is_running: false,
      is_installed: true,
      binary_path: "D:\\tools\\goose.exe",
      port: null,
      active_model: "gpt-4o",
      active_provider: "openai",
      error_message: null,
    };
    vi.mocked(invoke).mockResolvedValueOnce(updatedStatus);

    const res = await setGooseCustomBinaryPath("D:\\tools\\goose.exe");
    expect(res.binary_path).toBe("D:\\tools\\goose.exe");
    expect(invoke).toHaveBeenCalledWith("set_goose_custom_binary_path", { path: "D:\\tools\\goose.exe" });
  });

  it("fetches and saves AIConfig with provider settings and request format", async () => {
    const mockAIConfig: import("../types/goose").AIConfig = {
      active_provider: "ollama",
      request_format: "ollama",
      api_key: "",
      base_url: "http://localhost:11434/v1",
      model: "llama3.2",
      temperature: 0.7,
      max_tokens: 4096,
      system_prompt: "You are TheBerry assistant",
      language: "en",
      user_name: "Art",
      user_avatar: "data:image/png;base64,abc",
      enable_developer_tools: true,
      enable_web_fetch: true,
      custom_mcp_servers: [],
      goose_binary_path: "",
      auto_start_daemon: false,
    };

    vi.mocked(invoke).mockResolvedValueOnce(mockAIConfig);
    const config = await (await import("../services/goose")).getAIConfig();
    expect(config.active_provider).toBe("ollama");
    expect(config.request_format).toBe("ollama");
    expect(config.model).toBe("llama3.2");

    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await (await import("../services/goose")).saveAIConfig(mockAIConfig);
    expect(invoke).toHaveBeenCalledWith("save_ai_config", { config: mockAIConfig });
  });

  it("fetches provider models via fetchProviderModels", async () => {
    const mockModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    vi.mocked(invoke).mockResolvedValueOnce(mockModels);

    const models = await (await import("../services/goose")).fetchProviderModels(
      "gemini",
      "https://generativelanguage.googleapis.com/v1beta",
      "test-key",
      "gemini"
    );

    expect(models).toEqual(mockModels);
    expect(invoke).toHaveBeenCalledWith("fetch_provider_models", {
      provider: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "test-key",
      requestFormat: "gemini",
    });
  });
});

