import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { destructive } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_piReboot",
    {
      description: "Safely reboot the Raspberry Pi. Checks for running containers before rebooting.",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Reboot", {
          node: args.node,
          commands: () => ["sudo shutdown -r +0"],
          note: "Before rebooting it lists running containers and reads the uptime.",
        });
      }

      try {
        const names = (await execSSH("docker ps --format '{{.Names}}' 2>/dev/null | sort", args.node))
          .split("\n")
          .map((n) => n.trim())
          .filter(Boolean);

        let preCheck = "";
        if (names.length > 0) {
          preCheck =
            `Warning: ${names.length} running container(s) will be stopped.\n` +
            `Running containers before reboot: ${names.join(", ")}\n`;
        }

        const uptime = await execSSH("uptime -p", args.node);
        preCheck += `Current uptime: ${uptime}\n`;
        preCheck += "Initiating reboot...\n";

        await execSSH("sudo shutdown -r +0", args.node);

        return {
          content: [{
            type: "text" as const,
            text:
              preCheck +
              "Reboot command sent. Use the post-reboot-verify prompt with the container list above " +
              "to check that the node and its containers came back.",
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
