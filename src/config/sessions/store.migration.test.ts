import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { SessionEntry } from "./types.js";
import { loadSessionStore } from "./store.js";

// Mock loadConfig
vi.mock("../config.js", () => ({
  loadConfig: vi.fn(),
}));

describe("agent:main key migration", () => {
  let fixtureRoot: string;
  let storePath: string;
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-migration-test-"));
  });

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    storePath = path.join(fixtureRoot, `sessions-${Date.now()}.json`);
    const configModule = await import("../config.js");
    mockLoadConfig = configModule.loadConfig as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("migrates agent:main keys to new default agent when main is not explicit", async () => {
    // 1. Setup existing store with agent:main keys
    const initialStore = {
      "agent:main:telegram:dm:123": { sessionId: "s1", updatedAt: 100 } as SessionEntry,
      "agent:main:main": { sessionId: "s2", updatedAt: 200 } as SessionEntry,
      "agent:other:foo": { sessionId: "s3", updatedAt: 300 } as SessionEntry,
    };
    await fs.writeFile(storePath, JSON.stringify(initialStore), "utf-8");

    // 2. Mock config: default agent is 'helper', 'main' is NOT in list
    mockLoadConfig.mockReturnValue({
      agents: {
        list: [{ id: "helper", default: true }],
      },
    });

    // 3. Load store
    const store = loadSessionStore(storePath);

    // 4. Assertions
    expect(store["agent:helper:telegram:dm:123"]).toBeDefined();
    expect(store["agent:helper:telegram:dm:123"]?.sessionId).toBe("s1");
    expect(store["agent:helper:main"]).toBeDefined();
    expect(store["agent:helper:main"]?.sessionId).toBe("s2");

    // Original keys should be gone
    expect(store["agent:main:telegram:dm:123"]).toBeUndefined();
    expect(store["agent:main:main"]).toBeUndefined();

    // Other agent keys should be untouched
    expect(store["agent:other:foo"]).toBeDefined();
  });

  it("does NOT migrate if main is an explicit agent", async () => {
    const initialStore = {
      "agent:main:telegram:dm:123": { sessionId: "s1" } as SessionEntry,
    };
    await fs.writeFile(storePath, JSON.stringify(initialStore), "utf-8");

    // Mock config: default is 'helper', but 'main' is also present
    mockLoadConfig.mockReturnValue({
      agents: {
        list: [{ id: "helper", default: true }, { id: "main" }],
      },
    });

    const store = loadSessionStore(storePath);

    expect(store["agent:main:telegram:dm:123"]).toBeDefined();
    expect(store["agent:helper:telegram:dm:123"]).toBeUndefined();
  });

  it("does NOT migrate if default agent IS main", async () => {
    const initialStore = {
      "agent:main:telegram:dm:123": { sessionId: "s1" } as SessionEntry,
    };
    await fs.writeFile(storePath, JSON.stringify(initialStore), "utf-8");

    mockLoadConfig.mockReturnValue({
      agents: {
        list: [{ id: "main", default: true }],
      },
    });

    const store = loadSessionStore(storePath);

    expect(store["agent:main:telegram:dm:123"]).toBeDefined();
  });

  it("does NOT migrate if no default agent is found (defaults to main implicitly)", async () => {
    const initialStore = {
      "agent:main:telegram:dm:123": { sessionId: "s1" } as SessionEntry,
    };
    await fs.writeFile(storePath, JSON.stringify(initialStore), "utf-8");

    mockLoadConfig.mockReturnValue({}); // No agents config

    const store = loadSessionStore(storePath);

    expect(store["agent:main:telegram:dm:123"]).toBeDefined();
  });
});
