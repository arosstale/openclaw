import { describe, expect, it, vi, afterEach } from "vitest";
import type { RuntimeEnv } from "../../runtime.js";
import { sleep } from "../../utils.js";
import { sendMessageDiscord } from "../send.js";
import { deliverDiscordReply } from "./reply-delivery.js";

vi.mock("../send.js", () => ({
  sendMessageDiscord: vi.fn(async () => ({ id: "1", channel_id: "c1" })),
}));

vi.mock("../../utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils.js")>();
  return {
    ...actual,
    sleep: vi.fn(async () => {}),
  };
});

describe("deliverDiscordReply", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throttles multiple chunks", async () => {
    // 3000 chars -> chunks of 2000 + 1000
    const longText = "a".repeat(3000);

    await deliverDiscordReply({
      replies: [{ text: longText }],
      target: "channel:1",
      token: "token",
      runtime: {} as unknown as RuntimeEnv,
      textLimit: 2000,
      chunkMode: "length",
    });

    // Expect sendMessageDiscord called 2 times
    expect(sendMessageDiscord).toHaveBeenCalledTimes(2);
    // Expect sleep called at least 1 time (between chunks)
    expect(sleep).toHaveBeenCalled();
  });

  it("throttles multiple replies", async () => {
    await deliverDiscordReply({
      replies: [{ text: "msg1" }, { text: "msg2" }],
      target: "channel:1",
      token: "token",
      runtime: {} as unknown as RuntimeEnv,
      textLimit: 2000,
    });

    expect(sendMessageDiscord).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
  });
});
