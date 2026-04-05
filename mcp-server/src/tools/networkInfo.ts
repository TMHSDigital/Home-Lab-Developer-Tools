import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nodeParam } from "../utils/node-param.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_networkInfo",
    "Get network info from the Pi: IP addresses, interfaces, DNS, and Tailscale status",
    { ...nodeParam },
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
