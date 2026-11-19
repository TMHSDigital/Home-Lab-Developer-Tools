import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";
import { sinceSchema, toJournalSince } from "../utils/since-param.js";

const inputSchema = {
  ...nodeParam,
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
  since: sinceSchema("Only entries newer than this (e.g. 30m, 24h, 7d, or an ISO date)").optional(),
  lines: z
    .number()
    .int()
    .positive()
    .max(5000)
    .optional()
    .default(50)
    .describe("Number of journal lines to return"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_journalLogs",
    {
      description: "Query systemd journal logs with unit, priority, and time filters",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const parts = ["journalctl", "--no-pager", `-n ${args.lines}`];
        if (args.unit) parts.push(`--unit '${args.unit}'`);
        if (args.priority !== undefined) parts.push(`--priority ${args.priority}`);
        if (args.since) parts.push(`--since '${toJournalSince(args.since)}'`);
        const output = await execSSH(parts.join(" "), args.node);
        return { content: [{ type: "text" as const, text: output || "No journal entries matched the filters." }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
