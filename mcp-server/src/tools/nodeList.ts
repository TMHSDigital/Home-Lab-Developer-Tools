import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, listNodes, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {};

export function register(server: McpServer): void {
  server.tool(
    "homelab_nodeList",
    "List all managed nodes and their connection status",
    inputSchema,
    async () => {
      let nodes: { name: string; host: string }[];
      try {
        nodes = listNodes();
      } catch (error) {
        // Invalid HOMELAB_NODES: report it instead of hiding the nodes.
        return errorResponse(error);
      }
      const results: string[] = [];

      for (const node of nodes) {
        try {
          await execSSH("echo ok", node.name === "default" ? undefined : node.name);
          results.push(`${node.name} (${node.host}) -- online`);
        } catch (error) {
          const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
          results.push(`${node.name} (${node.host}) -- offline (${reason})`);
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: results.join("\n") || "No nodes configured.",
        }],
      };
    },
  );
}
