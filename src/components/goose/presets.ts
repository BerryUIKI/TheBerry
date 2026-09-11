import { AIConfig } from "../../types/goose";

export interface ProviderPreset {
  id: AIConfig["active_provider"];
  name: string;
  defaultBaseUrl: string;
  defaultRequestFormat: AIConfig["request_format"];
  defaultModel: string;
  models: string[];
  requiresApiKey: boolean;
  helpUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultRequestFormat: "openai",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4-turbo"],
    requiresApiKey: true,
    helpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultRequestFormat: "anthropic",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    requiresApiKey: true,
    helpUrl: "https://console.anthropic.com/",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultRequestFormat: "gemini",
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-flash-latest"],
    requiresApiKey: true,
    helpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultRequestFormat: "ollama",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5:7b", "deepseek-r1:8b", "mistral", "phi3"],
    requiresApiKey: false,
    helpUrl: "https://ollama.com/",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultRequestFormat: "openai",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    requiresApiKey: true,
    helpUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "groq",
    name: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultRequestFormat: "openai",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    requiresApiKey: true,
    helpUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultRequestFormat: "openai",
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    models: ["meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-exp:free", "deepseek/deepseek-r1"],
    requiresApiKey: true,
    helpUrl: "https://openrouter.ai/keys",
  },
  {
    id: "custom",
    name: "Custom (OpenAI Compatible)",
    defaultBaseUrl: "http://localhost:8000/v1",
    defaultRequestFormat: "openai",
    defaultModel: "custom-model",
    models: ["custom-model"],
    requiresApiKey: false,
    helpUrl: "",
  },
];
