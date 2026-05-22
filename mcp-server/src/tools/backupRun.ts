import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";

const inputSchema = {
  ...nodeParam,
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupRun",
    "Trigger a restic backup on the Pi",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Backup");
      }

      try {

        const output = await execSSH(
          "sudo /opt/backup/backup.sh 2>&1 || echo 'Backup script not found at /opt/backup/backup.sh'",
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
