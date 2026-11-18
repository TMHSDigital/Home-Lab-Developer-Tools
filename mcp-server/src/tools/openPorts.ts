import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_openPorts",
    {
      description: "Scan for listening TCP ports and map them to processes",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH("sudo ss -tlnp 2>&1", args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
