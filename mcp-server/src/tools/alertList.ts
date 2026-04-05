import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";

const DEFAULT_PORT = 9093;
const SERVICE_NAME = "Alertmanager";

const inputSchema = {
  state: z
    .enum(["active", "suppressed", "unprocessed"])
    .optional()
    .describe("Filter alerts by state. Returns all states if omitted"),
};

function getPort(): number {
  const override = process.env.HOMELAB_ALERTMANAGER_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_alertList",
    "List alerts from Alertmanager, optionally filtered by state",
    inputSchema,
    async (args) => {
      const port = getPort();
      try {
        const stateParam = args.state ? `?state=${args.state}` : "";
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/v2/alerts${stateParam}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_ALERTMANAGER_PORT if using a non-default port.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
