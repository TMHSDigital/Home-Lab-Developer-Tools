import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const DEFAULT_PORT = 3000;
const SERVICE_NAME = "Grafana";

const inputSchema = {
  ...nodeParam,
  dashboard: z.string().min(1).describe("Dashboard UID to export"),
};

function getPort(): number {
  const override = process.env.HOMELAB_GRAFANA_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

function buildAuthHeader(): string {
  const token = process.env.HOMELAB_GRAFANA_TOKEN;
  if (token) {
    return `-H 'Authorization: Bearer ${token}'`;
  }
  const user = process.env.HOMELAB_GRAFANA_USER || "admin";
  const password = process.env.HOMELAB_GRAFANA_PASSWORD;
  if (password) {
    return `-u '${user}:${password}'`;
  }
  return `-u 'admin:admin'`;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_grafanaSnapshot",
    "Export a Grafana dashboard configuration by UID",
    inputSchema,
    async (args) => {
      const port = getPort();
      try {
        const auth = buildAuthHeader();
        const output = await execSSH(
          `curl -sf ${auth} 'http://localhost:${port}/api/dashboards/uid/${args.dashboard}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not reach ${SERVICE_NAME} API on port ${port}. Is it running? ` +
                  `Set HOMELAB_GRAFANA_PORT if using a non-default port.`,
              ),
            );
          }
          if (error.exitCode === 22) {
            return errorResponse(
              new Error(
                `${SERVICE_NAME} returned an HTTP error. Check authentication -- ` +
                  `set HOMELAB_GRAFANA_TOKEN (API key) or HOMELAB_GRAFANA_USER/HOMELAB_GRAFANA_PASSWORD. ` +
                  `Also verify the dashboard UID "${args.dashboard}" exists.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
