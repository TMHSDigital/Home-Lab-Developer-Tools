import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, getNodeConfig } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_sshTest",
    {
      description: "Test SSH connectivity to the Raspberry Pi (or another registered node)",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        // Report the node that was actually tested, not the default Pi.
        const { host, port, username: user } = getNodeConfig(args.node);

        const output = await execSSH("echo ok && hostname && uptime -p", args.node);
        const lines = output.split("\n");

        return {
          content: [{
            type: "text" as const,
            text: [
              `SSH connection to ${user}@${host}:${port}: OK`,
              `Hostname: ${lines[1] || "unknown"}`,
              `Uptime: ${lines[2] || "unknown"}`,
            ].join("\n"),
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
