import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  jail: z
    .string()
    .optional()
    .describe("Specific jail name to query (e.g. sshd). Returns all jails if omitted"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_fail2banStatus",
    "List fail2ban jails, banned IPs, and ban counts",
    inputSchema,
    async (args) => {
      try {
        const cmd = args.jail
          ? `sudo fail2ban-client status '${args.jail}' 2>&1`
          : "sudo fail2ban-client status 2>&1";
        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
