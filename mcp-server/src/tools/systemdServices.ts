import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { CommandFailedError } from "../utils/errors.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
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
  server.registerTool(
    "homelab_systemdServices",
    {
      description: "List systemd units or get status of a specific unit",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const cmd = args.unit
          ? `systemctl status '${args.unit}' --no-pager 2>&1`
          : `systemctl list-units --type=${args.type || "service"} --no-pager 2>&1`;
        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        // systemctl status exits 3 for an inactive unit; its output is still
        // a valid status read. Other failures must remain errors.
        if (args.unit && error instanceof CommandFailedError && error.exitCode === 3) {
          return { content: [{ type: "text" as const, text: error.message }] };
        }
        return errorResponse(error);
      }
    },
  );
}
