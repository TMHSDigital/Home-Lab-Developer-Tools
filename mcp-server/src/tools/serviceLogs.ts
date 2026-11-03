import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { sinceSchema, toDockerSince } from "../utils/since-param.js";

const inputSchema = {
  ...nodeParam,
  service: z.string().min(1).describe("Container name to get logs from"),
  lines: z
    .number()
    .int()
    .positive()
    .max(5000)
    .optional()
    .default(50)
    .describe("Number of recent log lines to return"),
  since: sinceSchema("Only show logs newer than this (e.g. 30m, 2h, 7d, or an ISO date)").optional(),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_serviceLogs",
    "Tail recent logs from a Docker container on the Pi",
    inputSchema,
    async (args) => {
      try {
        const since = args.since ? ` --since ${toDockerSince(args.since)}` : "";
        const output = await execSSH(
          `docker logs --tail ${args.lines}${since} ${args.service} 2>&1`,
          args.node,
        );

        return {
          content: [{
            type: "text" as const,
            text: output || `No logs found for ${args.service}.`,
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
