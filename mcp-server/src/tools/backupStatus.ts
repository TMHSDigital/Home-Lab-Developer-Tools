import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { resticErrorResponse } from "../utils/restic.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";

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
  server.tool(
    "homelab_backupStatus",
    "Check the latest restic backup snapshots on the Pi",
    inputSchema,
    async (args) => {
      let repo = "";
      try {
        repo = backupRepo(args.node);
        const output = await execSSH(
          `sudo restic -r ${repo} snapshots --latest ${args.count}`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return resticErrorResponse(error, repo);
      }
    },
  );
}
