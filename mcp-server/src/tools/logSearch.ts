import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { sinceSchema, toDockerSince } from "../utils/since-param.js";

const inputSchema = {
  ...nodeParam,
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
    .max(5000)
    .optional()
    .default(100)
    .describe("Maximum matching lines to return (per container when searching all)"),
  since: sinceSchema(
    "Only search logs newer than this (e.g. 30m, 24h, 7d, or an ISO date). Default 24h",
  )
    .optional()
    .default("24h"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_logSearch",
    "Search across Docker container logs with grep patterns",
    inputSchema,
    async (args) => {
      try {
        const escaped = args.pattern.replace(/'/g, "'\\''");
        // Bound the work: only read logs inside the time window instead of
        // every container's full history. -e keeps patterns that start with
        // "-" from being parsed as grep options.
        const since = `--since ${toDockerSince(args.since)}`;
        const cmd = args.service
          ? `docker logs ${since} '${args.service}' 2>&1 | grep -i -e '${escaped}' | tail -${args.lines}`
          : `docker ps --format '{{.Names}}' | while read name; do matches=$(docker logs ${since} "$name" 2>&1 | grep -i -e '${escaped}' | tail -${args.lines}); if [ -n "$matches" ]; then echo "=== $name ==="; echo "$matches"; echo; fi; done`;
        const output = await execSSH(cmd, args.node, { timeoutMs: TIMEOUTS.medium });
        return {
          content: [{
            type: "text" as const,
            text: output || `No matches found for pattern '${args.pattern}' in the last ${args.since}.`,
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
