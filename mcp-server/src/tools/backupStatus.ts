import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  count: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(5)
    .describe("Number of recent snapshots to show"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupStatus",
    {
      description: "Check the latest restic backup snapshots on the Pi",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      let repo = "";
      try {
        repo = backupRepo(args.node);
        const output = await execSSH(
          resticCommand(`snapshots --latest ${args.count}`, args.node),
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return resticErrorResponse(error, repo);
      }
    },
  );
}
