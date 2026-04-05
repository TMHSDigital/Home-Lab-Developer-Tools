import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const DEFAULT_PORT = 3001;
const SERVICE_NAME = "Uptime Kuma";

function getPort(): number {
  const override = process.env.HOMELAB_UPTIME_KUMA_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_uptimeKumaStatus",
    "Get the status of all Uptime Kuma monitors",
    { ...nodeParam },
    async (args) => {
      const port = getPort();
      try {
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/status-page/heartbeat/default'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_UPTIME_KUMA_PORT if using a non-default port.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
