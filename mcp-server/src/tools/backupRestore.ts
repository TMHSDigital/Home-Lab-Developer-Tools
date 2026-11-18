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
  ...confirmParam,
};

function restoreCommand(args: { node?: string; snapshot: string; target: string; include?: string }): string {
  const includeFlag = args.include ? ` --include '${args.include}'` : "";
  return resticCommand(`restore '${args.snapshot}' --target '${args.target}'${includeFlag} 2>&1`, args.node);
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupRestore",
    {
      description: "Restore files from a restic backup snapshot to a target path on the Pi",
      inputSchema,
      annotations: destructive(true),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Restore", { node: args.node, commands: () => [restoreCommand(args)] });
      }

      try {

        const output = await execSSH(
          restoreCommand(args),
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
