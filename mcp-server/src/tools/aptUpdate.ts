import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmCancelled } from "../utils/confirm-param.js";

const inputSchema = {
  ...nodeParam,
  upgrade: z
    .boolean()
    .optional()
    .default(false)
    .describe("Also run apt upgrade after update (default: false, just lists upgradable). Requires confirm=true"),
  confirm: z
    .boolean()
    .optional()
    .describe("Safety gate. Must be true when upgrade is true; not needed to only list updates."),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_aptUpdate",
    "Run apt update on the Pi and list upgradable packages; optionally upgrade (requires confirm=true)",
    inputSchema,
    async (args) => {
      if (args.upgrade && args.confirm !== true) {
        // Upgrading changes system state (packages, services, possibly the
        // kernel), so it uses the same confirm gate as other mutating tools.
        return confirmCancelled("Package upgrade");
      }

      try {
        let cmd = "sudo apt-get update -qq 2>&1 && apt list --upgradable 2>/dev/null";
        if (args.upgrade) {
          // Non-interactive so a conffile prompt cannot block on stdin.
          cmd +=
            " && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y" +
            " -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold 2>&1";
        }

        const output = await execSSH(cmd, args.node, {
          timeoutMs: args.upgrade ? TIMEOUTS.long : TIMEOUTS.medium,
        });

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
