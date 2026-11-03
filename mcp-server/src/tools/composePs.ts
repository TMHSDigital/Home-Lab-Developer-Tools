import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nodeParam } from "../utils/node-param.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { buildComposeCommand } from "../utils/compose.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_composePs",
    "List running Docker Compose containers on the Pi",
    { ...nodeParam },
    async (args) => {
      try {
        const output = await execSSH(
          buildComposeCommand(`ps --format "table {{.Name}}\\t{{.Status}}\\t{{.Ports}}" 2>&1`),
          args.node,
        );

        return {
          content: [{
            type: "text" as const,
            text: output || "No compose containers running.",
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
