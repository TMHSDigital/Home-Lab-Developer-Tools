import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  snapshot: z
    .string()
    .min(1)
    .describe('Snapshot ID to restore (short hash or "latest")'),
  target: z
    .string()
    .min(1)
    .describe("Destination path on the Pi to restore files into"),
  include: z
    .string()
    .optional()
    .describe("Only restore files matching this pattern (e.g. /opt/homelab/docker/)"),
  confirm: z
    .boolean()
    .describe("Must be true to proceed with restore. Safety check."),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupRestore",
    "Restore files from a restic backup snapshot to a target path on the Pi",
    inputSchema,
    async (args) => {
      try {
        if (!args.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Restore cancelled. Set confirm=true to proceed.",
            }],
          };
        }

        const repo = process.env.HOMELAB_BACKUP_REPO || "/mnt/backup/restic";
        const includeFlag = args.include ? ` --include '${args.include}'` : "";
        const output = await execSSH(
          `sudo restic -r ${repo} restore '${args.snapshot}' --target '${args.target}'${includeFlag} 2>&1`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
