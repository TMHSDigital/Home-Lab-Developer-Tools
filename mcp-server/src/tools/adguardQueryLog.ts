import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";

const DEFAULT_PORT = 3000;
const SERVICE_NAME = "AdGuard Home";

const inputSchema = {
  search: z
    .string()
    .optional()
    .describe("Filter queries by domain or client IP"),
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .default(25)
    .describe("Number of recent queries to return"),
};

function getPort(): number {
  const override = process.env.HOMELAB_ADGUARD_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

function buildAuth(): string {
  const user = process.env.HOMELAB_ADGUARD_USER || "admin";
  const password = process.env.HOMELAB_ADGUARD_PASSWORD || "admin";
  return `-u '${user}:${password}'`;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_adguardQueryLog",
    "Search the AdGuard Home DNS query log",
    inputSchema,
    async (args) => {
      const port = getPort();
      try {
        const auth = buildAuth();
        const params: string[] = [`limit=${args.count}`];
        if (args.search) {
          params.push(`search=${encodeURIComponent(args.search)}`);
        }
        const query = params.join("&");
        const output = await execSSH(
          `curl -sf ${auth} 'http://localhost:${port}/control/querylog?${query}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_ADGUARD_PORT if using a non-default port.`,
              ),
            );
          }
          if (error.exitCode === 22) {
            return errorResponse(
              new Error(
                `${SERVICE_NAME} returned an HTTP error. Check authentication -- ` +
                  `set HOMELAB_ADGUARD_USER and HOMELAB_ADGUARD_PASSWORD.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
