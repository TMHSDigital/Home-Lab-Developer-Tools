import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe("Number of recent snapshots to show"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupStatus",
    "Check the latest restic backup snapshots on the Pi",
    inputSchema,
    async (args) => {
      try {
        const repo = process.env.HOMELAB_BACKUP_REPO || "/mnt/backup/restic";
        const output = await execSSH(
          `sudo restic -r ${repo} snapshots --latest ${args.count} 2>/dev/null || echo "No backup repo found at ${repo} or restic not configured"`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
