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
    .optional()
    .default(50)
    .describe("Number of recent history entries to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_aptHistory",
    "Show recent apt install, upgrade, and remove history",
    inputSchema,
    async (args) => {
      try {
        const cmd =
          `(grep -E '(Install|Upgrade|Remove|Commandline)' /var/log/apt/history.log 2>/dev/null; ` +
          `zgrep -E '(Install|Upgrade|Remove|Commandline)' /var/log/apt/history.log.*.gz 2>/dev/null) ` +
          `| tail -${args.lines}`;
        const output = await execSSH(cmd, args.node);
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
