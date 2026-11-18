import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  snapshotA: z.string().min(1).describe("First snapshot ID (older)"),
  snapshotB: z.string().min(1).describe("Second snapshot ID (newer)"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupDiff",
    {
      description: "Show the difference between two restic backup snapshots",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH(
          resticCommand(`diff '${args.snapshotA}' '${args.snapshotB}' 2>&1`, args.node),
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return resticErrorResponse(error, backupRepo(args.node));
      }
    },
  );
}
