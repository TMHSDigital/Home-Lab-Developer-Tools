import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { sinceSchema, toDockerSince } from "../utils/since-param.js";
import { READ_ONLY } from "../utils/annotations.js";

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
  server.registerTool(
    "homelab_logSearch",
    {
      description: "Search across Docker container logs with grep patterns",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        // The pattern travels base64-encoded and is decoded on the node, so
        // search text such as "poweroff" is data for grep, not part of the
        // command line the command guard inspects, and needs no shell quoting.
        const encoded = Buffer.from(args.pattern, "utf8").toString("base64");
        const pat = `pat=$(printf '%s' '${encoded}' | base64 -d)`;
        // Bound the work: only read logs inside the time window instead of
        // every container's full history. -e keeps patterns that start with
        // "-" from being parsed as grep options.
        const since = `--since ${toDockerSince(args.since)}`;
        // The pipeline's status is tail's, so a missing container would look
        // like "no matches"; check that it exists first.
        const exists = args.service
          ? `docker inspect --type container -f . '${args.service}' >/dev/null 2>&1 || { echo "No such container: ${args.service}" >&2; exit 1; }; `
          : "";
        const cmd = args.service
          ? `${exists}${pat}; docker logs ${since} '${args.service}' 2>&1 | grep -i -e "$pat" | tail -${args.lines}`
          : `${pat}; docker ps --format '{{.Names}}' | while read name; do matches=$(docker logs ${since} "$name" 2>&1 | grep -i -e "$pat" | tail -${args.lines}); if [ -n "$matches" ]; then echo "=== $name ==="; echo "$matches"; echo; fi; done`;
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
