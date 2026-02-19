import { describe, it, expect } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { buildAllowedModelSet } from "./model-selection.js";

describe("buildAllowedModelSet", () => {
  it("should include models from agents.defaults.model.fallbacks in allowlist", () => {
    const cfg: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-3-5-sonnet": {},
          },
          model: {
            fallbacks: ["anthropic/claude-opus-4-5", "openai/gpt-4o"],
          },
        },
      },
    };

    const catalog = [
      { provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
      { provider: "anthropic", id: "claude-opus-4-5", name: "Claude Opus 4.5" },
      { provider: "openai", id: "gpt-4o", name: "GPT-4o" },
    ];

    const result = buildAllowedModelSet({
      cfg: cfg as OpenClawConfig,
      catalog,
      defaultProvider: "anthropic",
      defaultModel: "claude-3-5-sonnet",
    });

    expect(result.allowAny).toBe(false);
    expect(result.allowedKeys.has("anthropic/claude-3-5-sonnet")).toBe(true);
    expect(result.allowedKeys.has("anthropic/claude-opus-4-5")).toBe(true);
    expect(result.allowedKeys.has("openai/gpt-4o")).toBe(true);
  });

  it("should handle model config as string without fallbacks", () => {
    const cfg: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-3-5-sonnet": {},
          },
          model: "anthropic/claude-3-5-sonnet",
        },
      },
    };

    const catalog = [{ provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" }];

    const result = buildAllowedModelSet({
      cfg: cfg as OpenClawConfig,
      catalog,
      defaultProvider: "anthropic",
      defaultModel: "claude-3-5-sonnet",
    });

    expect(result.allowAny).toBe(false);
    expect(result.allowedKeys.has("anthropic/claude-3-5-sonnet")).toBe(true);
  });

  it("should handle empty fallbacks array", () => {
    const cfg: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-3-5-sonnet": {},
          },
          model: {
            fallbacks: [],
          },
        },
      },
    };

    const catalog = [{ provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" }];

    const result = buildAllowedModelSet({
      cfg: cfg as OpenClawConfig,
      catalog,
      defaultProvider: "anthropic",
      defaultModel: "claude-3-5-sonnet",
    });

    expect(result.allowAny).toBe(false);
    expect(result.allowedKeys.has("anthropic/claude-3-5-sonnet")).toBe(true);
  });

  it("should include fallbacks even if not in catalog when provider is configured", () => {
    const cfg: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-3-5-sonnet": {},
          },
          model: {
            fallbacks: ["anthropic/claude-opus-4-5"],
          },
        },
      },
      models: {
        providers: {
          anthropic: { apiKey: "test-key" },
        },
      },
    };

    const catalog = [
      { provider: "anthropic", id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
      // Note: claude-opus-4-5 is NOT in catalog
    ];

    const result = buildAllowedModelSet({
      cfg: cfg as OpenClawConfig,
      catalog,
      defaultProvider: "anthropic",
      defaultModel: "claude-3-5-sonnet",
    });

    expect(result.allowAny).toBe(false);
    expect(result.allowedKeys.has("anthropic/claude-3-5-sonnet")).toBe(true);
    expect(result.allowedKeys.has("anthropic/claude-opus-4-5")).toBe(true);
  });
});
