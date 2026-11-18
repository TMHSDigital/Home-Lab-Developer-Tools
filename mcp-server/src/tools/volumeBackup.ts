import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { destructive } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  volume: z.string().min(1).describe("Docker volume name to back up"),
  ...confirmParam,
};

function volumeCommand(volume: string, node?: string): string {
  const volumePath = `/var/lib/docker/volumes/${volume}/_data`;
  return resticCommand(`backup '${volumePath}' --tag docker-volume --tag '${volume}' 2>&1`, node);
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_volumeBackup",
    {
      description: "Back up a specific Docker volume to the restic repository",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Volume backup", { node: args.node, commands: () => [volumeCommand(args.volume, args.node)] });
      }

      try {

        const output = await execSSH(
          volumeCommand(args.volume, args.node),
          args.node,
          { timeoutMs: TIMEOUTS.backup },
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return resticErrorResponse(error, backupRepo(args.node));
      }
    },
  );
}
