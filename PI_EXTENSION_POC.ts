/**
 * OpenClaw Router Extension - Proof of Concept
 * 
 * GREEN phase: Implement code to pass TDD tests
 * Bridges Pi agents with OpenClaw multi-channel messaging
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

// Channel types
type Channel = "discord" | "slack" | "telegram" | "whatsapp";
type Priority = "urgent" | "normal" | "bulk";
type DeliveryStatus = "delivered" | "failed" | "partial" | "retry" | "timeout";

interface RoutingResult {
  channel: Channel;
  status: DeliveryStatus;
  message?: string;
  error?: string;
}

interface RouteMessageParams {
  content: string;
  priority?: Priority;
  channels?: Channel[];
  richMedia?: unknown;
  timeout?: number;
  retryStrategy?: "exponential" | "linear" | "once";
}

interface RouteResult {
  status: DeliveryStatus;
  channels: Map<Channel, RoutingResult>;
  totalDelivered: number;
  totalFailed: number;
}

/**
 * Smart channel selection based on message characteristics
 * 
 * Rules:
 * - Discord: Code blocks, threads, links (rich formatting support)
 * - Slack: Long messages (>500 chars), professional tone
 * - Telegram: Short messages (<200 chars), quick updates
 * - WhatsApp: Very short (<160 chars), personal/direct
 */
export function selectOptimalChannel(
  message: string,
  preferences: Channel[] = []
): Channel {
  const length = message.length;
  const hasCode = message.includes("```");
  const hasLinks = message.includes("http");
  const isThreaded = message.includes("→");

  const scores: Record<Channel, number> = {
    discord: 0,
    slack: 0,
    telegram: 0,
    whatsapp: 0,
  };

  // Discord scoring: Great for code, threads, rich content
  if (hasCode || isThreaded) scores.discord += 10;
  if (hasLinks) scores.discord += 5;
  if (length > 500) scores.discord += 3;

  // Slack scoring: Professional, longer messages, snippets
  if (length > 500) scores.slack += 10;
  if (hasCode) scores.slack += 5;
  if (hasLinks) scores.slack += 3;

  // Telegram scoring: Quick, short messages
  if (length < 200 && !hasCode) scores.telegram += 8;
  if (length < 100) scores.telegram += 5;

  // WhatsApp scoring: Very short, personal
  if (length < 160 && !hasCode) scores.whatsapp += 7;

  // Apply user preferences (1.5x multiplier)
  for (const pref of preferences) {
    scores[pref] *= 1.5;
  }

  // Find highest-scored channel
  let best: Channel = "discord";
  let maxScore = scores.discord;

  for (const channel of ["slack", "telegram", "whatsapp"] as const) {
    if (scores[channel] > maxScore) {
      best = channel;
      maxScore = scores[channel];
    }
  }

  return best;
}

/**
 * Format message for target platform
 * Handles platform-specific constraints and syntax
 */
export function formatForChannel(message: string, channel: Channel): string {
  switch (channel) {
    case "discord":
      // Discord supports Markdown + code blocks
      // Add language hints to code blocks
      return message.replace(/```([^\n])/g, "```typescript\n$1");

    case "slack":
      // Slack has 4000 char limit
      // Supports limited Markdown
      const slackLimit = 4000;
      if (message.length > slackLimit) {
        return message.substring(0, slackLimit - 3) + "...";
      }
      return message;

    case "telegram":
      // Telegram has 4096 char limit
      // Convert Markdown to HTML
      const telegramLimit = 4096;
      let formatted = message
        .replace(/```[\w]*\n/g, "<code>")
        .replace(/```/g, "</code>")
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/`(.+?)`/g, "<code>$1</code>");

      if (formatted.length > telegramLimit) {
        return formatted.substring(0, telegramLimit - 3) + "...";
      }
      return formatted;

    case "whatsapp":
      // WhatsApp is plain text only, 4096 char limit
      const whatAppLimit = 4096;
      const plain = message
        .replace(/[*`_]/g, "") // Remove Markdown
        .replace(/<[^>]+>/g, ""); // Remove HTML tags

      if (plain.length > whatAppLimit) {
        return plain.substring(0, whatAppLimit - 3) + "...";
      }
      return plain;

    default:
      return message;
  }
}

/**
 * OpenClaw Router: Main routing engine
 */
export class OpenClawRouter {
  private readonly timeout: number;
  private readonly retryStrategy: RouteMessageParams["retryStrategy"];

  constructor(config?: { timeout?: number; retryStrategy?: string }) {
    this.timeout = config?.timeout ?? 30000;
    this.retryStrategy = (config?.retryStrategy as any) ?? "exponential";
  }

  /**
   * Route message through optimal channels
   */
  async routeMessage(params: RouteMessageParams): Promise<RouteResult> {
    const channels = params.channels || [
      selectOptimalChannel(params.content, []),
    ];

    if (channels.length === 0) {
      return {
        status: "failed",
        channels: new Map(),
        totalDelivered: 0,
        totalFailed: 0,
      };
    }

    const results = new Map<Channel, RoutingResult>();
    let delivered = 0;
    let failed = 0;

    // Attempt delivery to each channel
    for (const channel of channels) {
      try {
        const formatted = formatForChannel(params.content, channel);
        const result = await this.deliverToChannel(
          formatted,
          channel,
          params.priority ?? "normal"
        );

        results.set(channel, result);
        if (result.status === "delivered") {
          delivered++;
        } else {
          failed++;
        }
      } catch (error) {
        results.set(channel, {
          channel,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    const status: DeliveryStatus =
      failed === 0 ? "delivered" : failed === channels.length ? "failed" : "partial";

    return {
      status,
      channels: results,
      totalDelivered: delivered,
      totalFailed: failed,
    };
  }

  /**
   * Deliver formatted message to specific channel
   * Handles retries and priority
   */
  private async deliverToChannel(
    message: string,
    channel: Channel,
    priority: Priority
  ): Promise<RoutingResult> {
    // Simulated delivery - in production this would actually send
    // to OpenClaw channel handlers

    // Simulate priority handling
    if (priority === "urgent") {
      // Urgent: immediate delivery with notifications
      return {
        channel,
        status: "delivered",
        message: `Delivered to ${channel} (urgent)`,
      };
    }

    if (priority === "bulk") {
      // Bulk: batch for efficiency
      return {
        channel,
        status: "delivered",
        message: `Queued to ${channel} (bulk batch)`,
      };
    }

    // Normal: standard delivery
    return {
      channel,
      status: "delivered",
      message: `Delivered to ${channel}`,
    };
  }
}

/**
 * Pi Tool Integration
 * Registers openclaw-router as a Pi agent tool
 */
export const openClawRouterToolSchema = Type.Object({
  message: Type.String({ description: "Message to route through OpenClaw" }),
  priority: Type.Optional(
    Type.Enum(["urgent", "normal", "bulk"], {
      description: "Message priority level",
    })
  ),
  channels: Type.Optional(
    Type.Array(
      Type.Enum(["discord", "slack", "telegram", "whatsapp"], {
        description: "Channel name",
      }),
      { description: "Preferred channels (auto-selected if omitted)" }
    )
  ),
});

export function createOpenClawRouterTool(): AgentTool<any> {
  const router = new OpenClawRouter();

  return {
    name: "openclaw-router",
    label: "OpenClaw Router",
    description:
      "Route messages intelligently through OpenClaw channels with smart selection and format adaptation",
    parameters: openClawRouterToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as {
        message: string;
        priority?: Priority;
        channels?: Channel[];
      };

      const result = await router.routeMessage({
        content: params.message,
        priority: params.priority,
