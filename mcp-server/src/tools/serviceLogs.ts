import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  service: z.string().min(1).describe("Container name to get logs from"),
  lines: z
    .number()
    .int()
    .positive()
    .optional()
    .default(50)
    .describe("Number of recent log lines to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_serviceLogs",
    "Tail recent logs from a Docker container on the Pi",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH(
          `docker logs --tail ${args.lines} ${args.service} 2>&1`,
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
