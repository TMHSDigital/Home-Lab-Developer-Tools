import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nodeParam } from "../utils/node-param.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { READ_ONLY } from "../utils/annotations.js";

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_networkInfo",
    {
      description: "Get network info from the Pi: IP addresses, interfaces, DNS, and Tailscale status",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH([
          'echo "=== IP Addresses ==="',
          "ip -4 addr show | grep inet | awk '{print $NF, $2}'",
          'echo ""',
          'echo "=== Default Gateway ==="',
          "ip route | grep default",
          'echo ""',
          'echo "=== DNS ==="',
          "cat /etc/resolv.conf | grep nameserver",
          'echo ""',
          'echo "=== Tailscale ==="',
          "tailscale status 2>/dev/null || echo 'Tailscale not installed or not running'",
        ].join(" && "), args.node);

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
