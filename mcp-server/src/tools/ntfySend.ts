import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";

const DEFAULT_PORT = 8080;
const SERVICE_NAME = "Ntfy";

const inputSchema = {
  topic: z
    .string()
    .min(1)
    .describe("Ntfy topic to publish to"),
  message: z
    .string()
    .min(1)
    .describe("Notification message body"),
  title: z
    .string()
    .optional()
    .describe("Notification title"),
  priority: z
    .enum(["min", "low", "default", "high", "urgent"])
    .optional()
    .describe("Notification priority level"),
  tags: z
    .string()
    .optional()
    .describe("Comma-separated tags/emojis (e.g. 'warning,server')"),
};

function getPort(): number {
  const override = process.env.HOMELAB_NTFY_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_ntfySend",
    "Send a push notification via Ntfy",
    inputSchema,
    async (args) => {
      const port = getPort();
      try {
        const headers: string[] = [];
        if (args.title) headers.push(`-H 'Title: ${args.title}'`);
        if (args.priority) headers.push(`-H 'Priority: ${args.priority}'`);
        if (args.tags) headers.push(`-H 'Tags: ${args.tags}'`);
        const escaped = args.message.replace(/'/g, "'\\''");
        const cmd = `curl -sf -d '${escaped}' ${headers.join(" ")} 'http://localhost:${port}/${args.topic}'`;
        const output = await execSSH(cmd);
        return { content: [{ type: "text" as const, text: output || `Notification sent to topic '${args.topic}'.` }] };
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
