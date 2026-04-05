import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  pattern: z
    .string()
    .min(1)
    .describe("Grep pattern to search for in container logs"),
  service: z
    .string()
    .optional()
    .describe("Container name to search. Searches all running containers if omitted"),
  lines: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe("Maximum matching lines to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_logSearch",
    "Search across Docker container logs with grep patterns",
    inputSchema,
    async (args) => {
      try {
        const escaped = args.pattern.replace(/'/g, "'\\''");
        const cmd = args.service
          ? `docker logs '${args.service}' 2>&1 | grep -i '${escaped}' | tail -${args.lines}`
          : `docker ps --format '{{.Names}}' | while read name; do matches=$(docker logs "$name" 2>&1 | grep -i '${escaped}' | tail -${args.lines}); if [ -n "$matches" ]; then echo "=== $name ==="; echo "$matches"; echo; fi; done`;
        const output = await execSSH(cmd);
        return { content: [{ type: "text" as const, text: output || `No matches found for pattern '${args.pattern}'.` }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
