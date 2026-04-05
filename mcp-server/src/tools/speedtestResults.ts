import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";

const DEFAULT_PORT = 8765;
const SERVICE_NAME = "Speedtest Tracker";

const inputSchema = {
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe("Number of recent speedtest results to return"),
};

function getPort(): number {
  const override = process.env.HOMELAB_SPEEDTEST_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_speedtestResults",
    "Get recent speedtest results from Speedtest Tracker",
    inputSchema,
    async (args) => {
      const port = getPort();
      try {
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/speedtest/latest?limit=${args.count}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_SPEEDTEST_PORT if using a non-default port.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
