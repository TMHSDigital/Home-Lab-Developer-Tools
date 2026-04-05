import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_ufwStatus",
    "List UFW firewall rules and status",
    {},
    async () => {
      try {
        const output = await execSSH("sudo ufw status numbered 2>&1");
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
