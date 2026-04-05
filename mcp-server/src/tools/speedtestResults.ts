import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe("Number of recent speedtest results to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_speedtestResults",
    "Get recent speedtest results from Speedtest Tracker",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH(
          `curl -sf 'http://localhost:8765/api/speedtest/latest?limit=${args.count}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
