import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { fanOut, nodeOrAllParam } from "../utils/fan-out.js";
import { READ_ONLY } from "../utils/annotations.js";

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_ufwStatus",
    {
      description: "List UFW firewall rules and status",
      inputSchema: { ...nodeOrAllParam },
      annotations: READ_ONLY,
    },
    async (input) =>
      fanOut(input.node, async (node) => {
        const args = { ...input, node };
        try {
          const output = await execSSH("sudo ufw status numbered 2>&1", args.node);
          return { content: [{ type: "text" as const, text: output }] };
        } catch (error) {
          return errorResponse(error);
        }
      }),
  );
}
