import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  confirm: z
    .boolean()
    .describe("Must be true to trigger a backup. Safety check."),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupRun",
    "Trigger a restic backup on the Pi",
    inputSchema,
    async (args) => {
      try {
        if (!args.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Backup cancelled. Set confirm=true to proceed.",
            }],
          };
        }

        const output = await execSSH(
          "sudo /opt/backup/backup.sh 2>&1 || echo 'Backup script not found at /opt/backup/backup.sh'",
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
