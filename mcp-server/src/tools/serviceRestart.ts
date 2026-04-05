import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  service: z.string().min(1).describe("Container name to restart"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_serviceRestart",
    "Restart a Docker container on the Pi",
    inputSchema,
    async (args) => {
      try {
        await execSSH(`docker restart ${args.service}`);
        const status = await execSSH(
          `docker ps --filter "name=${args.service}" --format "{{.Names}}\\t{{.Status}}"`,
        );

        return {
          content: [{
            type: "text" as const,
            text: `Restarted ${args.service}.\n${status}`,
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
