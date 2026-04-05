import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  confirm: z
    .boolean()
    .describe("Must be true to proceed with reboot. Safety check to prevent accidental reboots."),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_piReboot",
    "Safely reboot the Raspberry Pi. Checks for running containers before rebooting.",
    inputSchema,
    async (args) => {
      try {
        if (!args.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Reboot cancelled. Set confirm=true to proceed.",
            }],
          };
        }

        const containers = await execSSH(
          "docker ps --format '{{.Names}}' 2>/dev/null | wc -l",
          args.node,
        );
        const count = parseInt(containers, 10) || 0;

        let preCheck = "";
        if (count > 0) {
          preCheck = `Warning: ${count} running container(s) will be stopped.\n`;
        }

        const uptime = await execSSH("uptime -p", args.node);
        preCheck += `Current uptime: ${uptime}\n`;
        preCheck += "Initiating reboot...\n";

        await execSSH("sudo shutdown -r +0", args.node);

        return {
          content: [{ type: "text" as const, text: preCheck + "Reboot command sent." }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
