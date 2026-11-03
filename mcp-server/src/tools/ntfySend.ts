import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.ntfy;

const inputSchema = {
  ...nodeParam,
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

export function register(server: McpServer): void {
  server.tool(
    "homelab_ntfySend",
    "Send a push notification via Ntfy",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const headers: string[] = [];
        if (args.title) headers.push(`-H 'Title: ${args.title}'`);
        if (args.priority) headers.push(`-H 'Priority: ${args.priority}'`);
        if (args.tags) headers.push(`-H 'Tags: ${args.tags}'`);
        const escaped = args.message.replace(/'/g, "'\\''");
        const cmd = `curl -sf -d '${escaped}' ${headers.join(" ")} 'http://localhost:${port}/${args.topic}'`;
        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output || `Notification sent to topic '${args.topic}'.` }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
