import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listNodes } from "./utils/ssh-api.js";

export const NODES_URI = "homelab://nodes";

/**
 * MCP resources. Only non-secret data is exposed: node names and hosts,
 * never usernames, key paths, or per-node env overrides.
 */
export function registerResources(server: McpServer): void {
  server.registerResource(
    "nodes",
    NODES_URI,
    {
      title: "Home lab nodes",
      description: "Managed nodes (name and host) from HOMELAB_PI_HOST and HOMELAB_NODES",
      mimeType: "application/json",
    },
    async (uri) => {
      let text: string;
      try {
        text = JSON.stringify({ nodes: listNodes() }, null, 2);
      } catch (error) {
        text = JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2);
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text }] };
    },
  );
}
