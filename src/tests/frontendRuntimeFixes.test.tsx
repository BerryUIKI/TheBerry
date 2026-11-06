// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "solid-js/web";
import { JSX } from "solid-js";
import { FolderPairBar } from "../components/folder_sync/FolderPairBar";
import { StructuredDataModal } from "../components/toolbox/StructuredDataModal";
import { AISection } from "../components/settings/sections/AISection";
import { AIConfig } from "../types/goose";

vi.mock("../context/I18nContext", () => ({
  useI18n: () => ({ t: (key: string) => key, language: () => "en" }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

function mount(component: () => JSX.Element) {
  const container = document.createElement("div");
  const dispose = render(component, container);
  return { container, dispose };
}

const configuredAI: AIConfig = {
  active_provider: "openai",
  request_format: "openai",
  api_key: "sk-test",
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o",
  temperature: 0.7,
  max_tokens: 4096,
  system_prompt: "",
  language: "en",
  user_name: "You",
  user_avatar: "",
  enable_developer_tools: true,
  enable_web_fetch: true,
  custom_mcp_servers: [],
  goose_binary_path: "",
  auto_start_daemon: false,
};

describe("frontend runtime fixes", () => {
  it("renders FolderPairBar with translated source and target labels", () => {
    const { container, dispose } = mount(() => (
      <FolderPairBar
        leftPath=""
        rightPath=""
        onLeftPathChange={() => {}}
        onRightPathChange={() => {}}
        onSwapPaths={() => {}}
        isScanning={false}
      />
    ));

    expect(container.textContent).toContain("folder_sync.left_folder");
    expect(container.textContent).toContain("Source");
    expect(container.textContent).toContain("folder_sync.right_folder");
    expect(container.textContent).toContain("Target");
    dispose();
  });

  it("renders StructuredDataModal pane headers", () => {
    const { container, dispose } = mount(() => (
      <StructuredDataModal isOpen onClose={() => {}} />
    ));

    expect(container.textContent).toContain("Input");
    expect(container.textContent).toContain("Output");
    dispose();
  });

  it("reports AI configuration from real fields", () => {
    const { container, dispose } = mount(() => (
      <AISection aiConfig={() => configuredAI} onOpenModal={() => {}} />
    ));

    expect(container.textContent).toContain("Provider credentials configured");
    dispose();
  });
});
