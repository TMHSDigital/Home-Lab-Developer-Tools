import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_sshTest",
    "Test SSH connectivity to the Raspberry Pi",
    {},
    async () => {
      try {
        const host = process.env.HOMELAB_PI_HOST || "raspi5.local";
        const user = process.env.HOMELAB_PI_USER || "tmhs";

        const output = await execSSH("echo ok && hostname && uptime -p");
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
