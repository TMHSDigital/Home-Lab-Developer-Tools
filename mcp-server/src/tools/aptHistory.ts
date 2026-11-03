import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  lines: z
    .number()
    .int()
    .positive()
    .max(5000)
    .optional()
    .default(50)
    .describe("Number of recent history entries to return"),
};

const PATTERN = "'(Install|Upgrade|Remove|Commandline)'";

/**
 * Emit history oldest-to-newest so `tail` keeps the most recent entries:
 * rotated archives in reverse numeric order (history.log.12.gz ... .1.gz),
 * then the current history.log last.
 */
export function buildAptHistoryCommand(lines: number): string {
  return (
    `{ ls -1v /var/log/apt/history.log.*.gz 2>/dev/null | tac | ` +
    `xargs -r zgrep -hE ${PATTERN} 2>/dev/null; ` +
    `grep -hE ${PATTERN} /var/log/apt/history.log 2>/dev/null; } ` +
    `| tail -n ${lines}`
  );
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_aptHistory",
    "Show recent apt install, upgrade, and remove history",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH(buildAptHistoryCommand(args.lines), args.node);
        return {
          content: [{
            type: "text" as const,
            text: output || "No apt history entries found.",
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
