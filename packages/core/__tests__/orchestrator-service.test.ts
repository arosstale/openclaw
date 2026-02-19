import { registerSubagentRun, initSubagentRegistry } from "openclaw";
import { vi, describe, it, expect } from "vitest";
import { OrchestratorService } from "../src/orchestrator-service.js";

vi.mock("openclaw", async (importOriginal) => {
  const mod = await importOriginal<typeof import("openclaw")>();
  return {
    ...mod,
    initSubagentRegistry: vi.fn(),
    registerSubagentRun: vi.fn(),
  };
});

describe("OrchestratorService", () => {
  it("initializes subagent registry", () => {
    new OrchestratorService();
    expect(initSubagentRegistry).toHaveBeenCalled();
  });

  it("registers subagent run", () => {
    const service = new OrchestratorService();
    const params = {
      runId: "test-run",
      childSessionKey: "child-key",
      requesterSessionKey: "req-key",
      requesterDisplayKey: "req-display",
      task: "task",
      cleanup: "delete" as const,
    };

    service.registerRun(params);

    expect(registerSubagentRun).toHaveBeenCalledWith(params);
  });
});
