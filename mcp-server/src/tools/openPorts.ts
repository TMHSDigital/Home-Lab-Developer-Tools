import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_openPorts",
    "Scan for listening TCP ports and map them to processes",
    {},
    async () => {
      try {
        const output = await execSSH("sudo ss -tlnp 2>&1");
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
