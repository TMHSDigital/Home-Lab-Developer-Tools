import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nodeParam } from "../utils/node-param.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { sectionScript, type Section } from "../utils/section-script.js";
import { READ_ONLY } from "../utils/annotations.js";

export const NETWORK_SECTIONS: Section[] = [
  ["IP Addresses", "ip -4 addr show | awk '/inet /{print $NF, $2}'"],
  ["Default Gateway", "ip route show default | grep . || echo 'No default route'"],
  ["DNS", "grep nameserver /etc/resolv.conf || echo 'No nameserver entries in /etc/resolv.conf'"],
  [
    "Tailscale",
    "if command -v tailscale >/dev/null 2>&1; then tailscale status; else echo 'Tailscale not installed'; fi",
  ],
];

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
        const output = await execSSH(sectionScript(NETWORK_SECTIONS), args.node);

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
