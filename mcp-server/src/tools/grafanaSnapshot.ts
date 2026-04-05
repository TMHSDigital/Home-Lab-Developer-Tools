import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  dashboard: z.string().min(1).describe("Dashboard UID to export"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_grafanaSnapshot",
    "Export a Grafana dashboard configuration by UID",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH(
          `curl -sf 'http://localhost:3000/api/dashboards/uid/${args.dashboard}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
