import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nodeParam } from "../utils/node-param.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { buildComposeCommand } from "../utils/compose.js";
import { READ_ONLY } from "../utils/annotations.js";

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_composePs",
    {
      description: "List running Docker Compose containers on the Pi",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH(
          buildComposeCommand(`ps --format "table {{.Name}}\\t{{.Status}}\\t{{.Ports}}" 2>&1`, undefined, args.node),
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
