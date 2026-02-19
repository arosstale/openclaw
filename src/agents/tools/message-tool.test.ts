import { describe, it, expect, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { listChannelSupportedActions } from "../channel-tools.js";
import { createMessageTool } from "./message-tool.js";

vi.mock("../channel-tools.js", () => ({
  listChannelSupportedActions: vi.fn(),
  listChannelAgentTools: vi.fn(() => []),
}));

vi.mock("../../channels/plugins/message-actions.js", () => ({
  listChannelMessageActions: vi.fn(() => ["send"]),
  supportsChannelMessageButtons: vi.fn(() => false),
  supportsChannelMessageCards: vi.fn(() => false),
}));

describe("message-tool description", () => {
  it("should show other configured channels when currentChannelProvider is set", () => {
    vi.mocked(listChannelSupportedActions).mockReturnValue(["send"]);

    const config: OpenClawConfig = {
      channels: {
        telegram: { enabled: true },
        discord: { enabled: false },
        whatsapp: {},
        slack: { enabled: true },
        defaults: {},
      },
    } as unknown as OpenClawConfig;

    const tool = createMessageTool({
      config,
      currentChannelProvider: "telegram",
    });

    const description = tool.description || "";

    expect(description).toContain("Current channel (telegram) supports: send.");

    expect(description).toContain("Other configured channels: slack, whatsapp");
    expect(description).not.toContain("discord");
    expect(description).not.toContain("defaults");
  });
});
