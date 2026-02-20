import type { App } from "@slack/bolt";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import type { RuntimeEnv } from "../../../runtime.js";
import type { ResolvedSlackAccount } from "../../accounts.js";
import type { SlackMessageEvent } from "../../types.js";
import { createSlackMonitorContext } from "../context.js";
import { prepareSlackMessage } from "./prepare.js";

describe("slack prepareSlackMessage inheritParent", () => {
  let fixtureRoot = "";

  beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-slack-inherit-"));
  });

  afterAll(() => {
    if (fixtureRoot) {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = "";
    }
  });

  function createThreadSlackCtx(params: {
    cfg: OpenClawConfig;
    replies: unknown;
    inheritParent?: boolean;
  }) {
    return createSlackMonitorContext({
      cfg: params.cfg,
      accountId: "default",
      botToken: "token",
      app: { client: { conversations: { replies: params.replies } } } as App,
      runtime: {} as RuntimeEnv,
      botUserId: "B1",
      teamId: "T1",
      apiAppId: "A1",
      historyLimit: 10,
      sessionScope: "per-sender",
      mainKey: "main",
      dmEnabled: true,
      dmPolicy: "open",
      allowFrom: [],
      groupDmEnabled: true,
      groupDmChannels: [],
      defaultRequireMention: false,
      groupPolicy: "open",
      useAccessGroups: false,
      reactionMode: "off",
      reactionAllowlist: [],
      replyToMode: "all",
      threadHistoryScope: "thread",
      threadInheritParent: params.inheritParent ?? false,
      slashCommand: {
        enabled: false,
        name: "openclaw",
        sessionPrefix: "slack:slash",
        ephemeral: true,
      },
      textLimit: 4000,
      ackReactionScope: "group-mentions",
      mediaMaxBytes: 1024,
      removeAckAfterReply: false,
    });
  }

  function createThreadAccount(): ResolvedSlackAccount {
    return {
      accountId: "default",
      enabled: true,
      botTokenSource: "config",
      appTokenSource: "config",
      config: {
        replyToMode: "all",
        thread: { initialHistoryLimit: 20 },
      },
    };
  }

  it("includes thread starter in InboundHistory when inheritParent is true and session is new", async () => {
    const storePath = path.join(fixtureRoot, "sessions.json");

    // Mock replies to return the starter message
    const replies = vi.fn().mockResolvedValueOnce({
      messages: [{ text: "parent message", user: "U2", ts: "100.000" }],
    });

    const slackCtx = createThreadSlackCtx({
      cfg: {
        session: { store: storePath },
        channels: { slack: { enabled: true, replyToMode: "all", groupPolicy: "open" } },
      } as OpenClawConfig,
      replies,
      inheritParent: true,
    });

    // Mock user resolution
    slackCtx.resolveUserName = async (id) => ({ name: id === "U2" ? "Bob" : "Alice" });
    slackCtx.resolveChannelName = async () => ({ name: "general", type: "channel" });

    const account = createThreadAccount();

    const message: SlackMessageEvent = {
      channel: "C123",
      channel_type: "channel",
      user: "U1",
      text: "reply in new thread",
      ts: "101.000",
      thread_ts: "100.000",
    } as SlackMessageEvent;

    const prepared = await prepareSlackMessage({
      ctx: slackCtx,
      account,
      message,
      opts: { source: "message" },
    });

    expect(prepared).toBeTruthy();

    // We expect the parent message to be in InboundHistory
    // Currently, without the fix, InboundHistory is likely undefined or empty because it's a new session.
    expect(prepared!.ctxPayload.InboundHistory).toBeDefined();
    expect(prepared!.ctxPayload.InboundHistory!.length).toBeGreaterThan(0);
    expect(prepared!.ctxPayload.InboundHistory![0].body).toContain("parent message");
  });
});
