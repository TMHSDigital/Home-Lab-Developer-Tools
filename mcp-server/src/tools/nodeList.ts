import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, listNodes } from "../utils/ssh-api.js";

const inputSchema = {};

export function register(server: McpServer): void {
  server.tool(
    "homelab_nodeList",
    "List all managed nodes and their connection status",
    inputSchema,
    async () => {
      const nodes = listNodes();
      const results: string[] = [];

      for (const node of nodes) {
        try {
          await execSSH("echo ok", node.name === "default" ? undefined : node.name);
          results.push(`${node.name} (${node.host}) -- online`);
        } catch {
          results.push(`${node.name} (${node.host}) -- offline`);
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
