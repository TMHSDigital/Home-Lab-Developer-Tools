import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  service: z
    .string()
    .optional()
    .describe("Specific container name to check, or omit for all"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_serviceHealth",
    "Check Docker container health status on the Pi",
    inputSchema,
    async (args) => {
      try {
        const filter = args.service ? `--filter "name=${args.service}"` : "";
        const ps = await execSSH(
          `docker ps ${filter} --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"`,
        );

        const unhealthy = await execSSH(
          `docker ps ${filter} --filter "health=unhealthy" --format "{{.Names}}"`,
        );

        let text = ps || "No containers found.";
        if (unhealthy) {
          text += `\n\nUnhealthy containers: ${unhealthy}`;
        } else {
          text += "\n\nAll containers healthy.";
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
