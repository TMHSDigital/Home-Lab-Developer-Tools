import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const DEFAULT_PORT = 8080;
const SERVICE_NAME = "Ntfy";

/** Ntfy topic names: [-_A-Za-z0-9]{1,64}; several can be joined with commas. */
export const TOPIC_LIST_RE = /^[-_A-Za-z0-9]{1,64}(,[-_A-Za-z0-9]{1,64})*$/;

/** Resolve the topic list from the argument or HOMELAB_NTFY_TOPICS. */
export function resolveTopics(topic?: string): string | null {
  const candidate = (topic ?? process.env.HOMELAB_NTFY_TOPICS ?? "").replace(/\s+/g, "");
  if (!candidate) return null;
  return TOPIC_LIST_RE.test(candidate) ? candidate : null;
}

const inputSchema = {
  ...nodeParam,
  topic: z
    .string()
    .regex(TOPIC_LIST_RE, "Topic names may only contain letters, digits, '-' and '_' (comma-separate several)")
    .optional()
    .describe(
      "Topic, or comma-separated topics (e.g. 'alerts,backups'). Defaults to HOMELAB_NTFY_TOPICS. " +
        "Ntfy has no 'all topics' subscription, so at least one topic is required",
    ),
  since: z
    .string()
    .optional()
    .default("1h")
    .describe("Time window for recent messages (e.g. '1h', '30m', '1d')"),
};

function getPort(): number {
  const override = process.env.HOMELAB_NTFY_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_ntfyTopics",
    "List Ntfy topics and recent messages",
    inputSchema,
    async (args) => {
      const port = getPort();
      const topicPath = resolveTopics(args.topic);
      if (!topicPath) {
        return errorResponse(
          new Error(
            "No ntfy topic given. Pass `topic` (one topic or a comma-separated list such as " +
              "'alerts,backups') or set HOMELAB_NTFY_TOPICS. Ntfy has no wildcard subscription for all topics.",
          ),
        );
      }
      try {
        const cmd = `curl -sf 'http://localhost:${port}/${topicPath}/json?since=${args.since}&poll=1'`;
        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output || "No recent messages found." }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_NTFY_PORT if using a non-default port.`,
              ),
            );
          }
          if (error.exitCode === 22) {
            return errorResponse(
              new Error(
                `${SERVICE_NAME} returned an HTTP error for topic(s) "${topicPath}". Check the topic ` +
                  `names, the 'since' value (e.g. 1h, 30m, all), and access control on the server.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
