import { describe, expect, it, vi } from "vitest";
import { runWithModelFallback } from "./model-fallback";
import type { OpenClawConfig } from "../config/config.js";

describe("runWithModelFallback reproduction", () => {
  it("should use fallbacks even if they are not in the allowlist", async () => {
    const run = vi.fn();
    run.mockRejectedValue(new Error("Rate limit"));

    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: {
            primary: "provider/primary",
            fallbacks: ["provider/fallback"],
          },
          models: {
            "provider/primary": {},
            // provider/fallback is missing
          }
        },
      },
    } as any;

    // We expect it to try BOTH primary and fallback, so failures count should be 2.
    // If it fails with 1, it means fallback was skipped.
    await expect(runWithModelFallback({
      cfg,
      provider: "provider",
      model: "primary",
      run,
    })).rejects.toThrow(/All models failed \(2\)/);
  });
});
