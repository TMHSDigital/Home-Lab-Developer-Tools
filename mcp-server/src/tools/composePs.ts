import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const COMPOSE_DIR = process.env.HOMELAB_COMPOSE_DIR || "/opt/homelab/docker";

export function register(server: McpServer): void {
  server.tool(
    "homelab_composePs",
    "List running Docker Compose containers on the Pi",
    {},
    async () => {
      try {
        const output = await execSSH(
          `cd ${COMPOSE_DIR} && docker compose -f compose.base.yml -f compose.monitoring.yml -f compose.network.yml -f compose.apps.yml -f compose.security.yml -f compose.storage.yml -f compose.tools.yml ps --format "table {{.Name}}\\t{{.Status}}\\t{{.Ports}}" 2>&1`,
        );

        return {
          content: [{
            type: "text" as const,
            text: output || "No compose containers running.",
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
