import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_uptimeKumaStatus",
    "Get the status of all Uptime Kuma monitors",
    {},
    async () => {
      try {
        const output = await execSSH(
          `curl -sf 'http://localhost:3001/api/status-page/heartbeat/default'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
