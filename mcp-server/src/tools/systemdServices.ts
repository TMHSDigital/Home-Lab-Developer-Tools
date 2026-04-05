import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  unit: z
    .string()
    .optional()
    .describe("Specific unit name to get status for (e.g. docker.service, restic-backup.timer)"),
  type: z
    .enum(["service", "timer", "socket", "mount"])
    .optional()
    .describe("Filter by unit type when listing. Defaults to 'service'"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_systemdServices",
    "List systemd units or get status of a specific unit",
    inputSchema,
    async (args) => {
      try {
        const cmd = args.unit
          ? `systemctl status '${args.unit}' --no-pager 2>&1`
          : `systemctl list-units --type=${args.type || "service"} --no-pager 2>&1`;
        const output = await execSSH(cmd);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
