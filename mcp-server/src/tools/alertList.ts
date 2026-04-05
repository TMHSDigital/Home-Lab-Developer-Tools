import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  state: z
    .enum(["active", "suppressed", "unprocessed"])
    .optional()
    .describe("Filter alerts by state. Returns all states if omitted"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_alertList",
    "List alerts from Alertmanager, optionally filtered by state",
    inputSchema,
    async (args) => {
      try {
        const stateParam = args.state ? `?state=${args.state}` : "";
        const output = await execSSH(
          `curl -sf 'http://localhost:9093/api/v2/alerts${stateParam}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
