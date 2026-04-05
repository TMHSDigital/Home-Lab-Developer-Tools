import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const DEFAULT_PORT = 8080;
const SERVICE_NAME = "Ntfy";

const inputSchema = {
  ...nodeParam,
  topic: z
    .string()
    .optional()
    .describe("Specific topic to check. Lists all cached messages if omitted"),
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
      try {
        const topicPath = args.topic || "*";
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
        }
        return errorResponse(error);
      }
    },
  );
}
