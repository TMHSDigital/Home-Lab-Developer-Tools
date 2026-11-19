import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { sectionScript } from "../utils/section-script.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  path: z
    .string()
    .optional()
    .default("/")
    .describe("Path to check disk usage for (default: /)"),
  depth: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Directory depth for breakdown (default: 1)"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_diskUsage",
    {
      description: "Get detailed disk usage breakdown on the Pi",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH(sectionScript([
          // df exits 1 when any mount is unreadable but still lists the rest.
          ["Filesystem", "df -h"],
          [
            `Directory Usage (${args.path}, depth ${args.depth})`,
            // -x: stay on one filesystem (skip /proc, overlay and network mounts)
            `sudo du -x -h --max-depth=${args.depth} ${args.path} 2>/dev/null | sort -rh | head -20`,
          ],
          [
            "Docker Disk Usage",
            "if command -v docker >/dev/null 2>&1; then docker system df; else echo 'Docker not installed'; fi",
          ],
        ]), args.node, { timeoutMs: TIMEOUTS.medium });

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
