import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  snapshotA: z.string().min(1).describe("First snapshot ID (older)"),
  snapshotB: z.string().min(1).describe("Second snapshot ID (newer)"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupDiff",
    "Show the difference between two restic backup snapshots",
    inputSchema,
    async (args) => {
      try {
        const repo = process.env.HOMELAB_BACKUP_REPO || "/mnt/backup/restic";
        const output = await execSSH(
          `sudo restic -r ${repo} diff '${args.snapshotA}' '${args.snapshotB}' 2>&1`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
