import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, getNodeConfig } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_sshTest",
    "Test SSH connectivity to the Raspberry Pi (or another registered node)",
    { ...nodeParam },
    async (args) => {
      try {
        // Report the node that was actually tested, not the default Pi.
        const { host, username: user } = getNodeConfig(args.node);

        const output = await execSSH("echo ok && hostname && uptime -p", args.node);
        const lines = output.split("\n");

        return {
          content: [{
            type: "text" as const,
            text: [
              `SSH connection to ${user}@${host}: OK`,
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
