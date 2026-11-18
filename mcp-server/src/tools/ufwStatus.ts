import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_ufwStatus",
    {
      description: "List UFW firewall rules and status",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
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
