import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  upgrade: z
    .boolean()
    .optional()
    .default(false)
    .describe("Also run apt upgrade after update (default: false, just lists upgradable)"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_aptUpdate",
    "Run apt update on the Pi and list upgradable packages",
    inputSchema,
    async (args) => {
      try {
        let cmd = "sudo apt-get update -qq 2>&1 && apt list --upgradable 2>/dev/null";
        if (args.upgrade) {
          cmd += " && sudo apt-get upgrade -y 2>&1";
        }

        const output = await execSSH(cmd);

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
