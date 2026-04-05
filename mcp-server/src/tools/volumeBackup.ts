import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  volume: z.string().min(1).describe("Docker volume name to back up"),
  confirm: z
    .boolean()
    .describe("Must be true to trigger backup. Safety check."),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_volumeBackup",
    "Back up a specific Docker volume to the restic repository",
    inputSchema,
    async (args) => {
      try {
        if (!args.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Volume backup cancelled. Set confirm=true to proceed.",
            }],
          };
        }

        const repo = process.env.HOMELAB_BACKUP_REPO || "/mnt/backup/restic";
        const volumePath = `/var/lib/docker/volumes/${args.volume}/_data`;
        const output = await execSSH(
          `sudo restic -r ${repo} backup '${volumePath}' --tag docker-volume --tag '${args.volume}' 2>&1`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
