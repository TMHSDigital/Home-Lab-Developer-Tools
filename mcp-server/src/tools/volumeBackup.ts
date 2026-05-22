import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";

const inputSchema = {
  ...nodeParam,
  volume: z.string().min(1).describe("Docker volume name to back up"),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_volumeBackup",
    "Back up a specific Docker volume to the restic repository",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Volume backup");
      }

      try {

        const repo = process.env.HOMELAB_BACKUP_REPO || "/mnt/backup/restic";
        const volumePath = `/var/lib/docker/volumes/${args.volume}/_data`;
        const output = await execSSH(
          `sudo restic -r ${repo} backup '${volumePath}' --tag docker-volume --tag '${args.volume}' 2>&1`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
