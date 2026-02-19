import {
  initSubagentRegistry,
  registerSubagentRun,
  resetSubagentRegistryForTests,
  listSubagentRunsForRequester,
} from "openclaw";
import { vi, describe, it, beforeEach, expect } from "vitest";

// Mock internal dependencies using relative paths from packages/core/__tests__
// The relative path to src/ from packages/core/__tests__/ is ../../../src/
vi.mock("../../../src/config/config.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../src/config/config.js")>();
  return {
    ...mod,
    loadConfig: () => ({ agents: { defaults: { subagents: { archiveAfterMinutes: 60 } } } }),
  };
});

vi.mock("../../../src/gateway/call.js", () => ({
  callGateway: vi.fn().mockResolvedValue({ status: "ok" }),
}));

describe("SubagentRegistry", () => {
  beforeEach(() => {
    resetSubagentRegistryForTests({ persist: false });
    initSubagentRegistry();
  });

  it("registers and lists subagent runs", () => {
    const runId = "test-run-1";
    const requesterSessionKey = "requester-session-1";

    registerSubagentRun({
      runId,
      childSessionKey: "child-session-1",
      requesterSessionKey,
      requesterDisplayKey: "requester-display-1",
      task: "test-task",
      cleanup: "delete",
    });

    const runs = listSubagentRunsForRequester(requesterSessionKey);
    expect(runs).toHaveLength(1);
    expect(runs[0].runId).toBe(runId);
    expect(runs[0].task).toBe("test-task");
  });
});
