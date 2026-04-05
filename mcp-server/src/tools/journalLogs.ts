import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  unit: z
    .string()
    .optional()
    .describe("Systemd unit name to filter (e.g. docker.service, ssh.service)"),
  priority: z
    .number()
    .int()
    .min(0)
    .max(7)
    .optional()
    .describe("Syslog priority level 0-7 (0=emerg, 3=err, 4=warning, 6=info, 7=debug)"),
  since: z
    .string()
    .optional()
    .describe("Time specification like '1 hour ago', '2024-01-01', 'today'"),
  lines: z
    .number()
    .int()
    .positive()
    .optional()
    .default(50)
    .describe("Number of journal lines to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_journalLogs",
    "Query systemd journal logs with unit, priority, and time filters",
    inputSchema,
    async (args) => {
      try {
        const parts = ["journalctl", "--no-pager", `-n ${args.lines}`];
        if (args.unit) parts.push(`--unit '${args.unit}'`);
        if (args.priority !== undefined) parts.push(`--priority ${args.priority}`);
        if (args.since) parts.push(`--since '${args.since}'`);
        const output = await execSSH(parts.join(" "));
        return { content: [{ type: "text" as const, text: output || "No journal entries matched the filters." }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
