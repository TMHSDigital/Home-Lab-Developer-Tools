import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
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
  server.tool(
    "homelab_diskUsage",
    "Get detailed disk usage breakdown on the Pi",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH([
          'echo "=== Filesystem ==="',
          "df -h",
          'echo ""',
          `echo "=== Directory Usage (${args.path}, depth ${args.depth}) ==="`,
          `sudo du -h --max-depth=${args.depth} ${args.path} 2>/dev/null | sort -rh | head -20`,
          'echo ""',
          'echo "=== Docker Disk Usage ==="',
          "docker system df 2>/dev/null || echo 'Docker not available'",
        ].join(" && "));

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
