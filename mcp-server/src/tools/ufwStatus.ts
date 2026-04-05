import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_ufwStatus",
    "List UFW firewall rules and status",
    { ...nodeParam },
    async (args) => {
      try {
        const output = await execSSH("sudo ufw status numbered 2>&1", args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
