import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {};

export function register(server: McpServer): void {
  server.tool(
    "homelab_aptUpgradable",
    "List upgradable packages with current and candidate versions",
    inputSchema,
    async () => {
      try {
        const output = await execSSH(
          "apt list --upgradable 2>/dev/null | grep -v '^Listing'",
        );
        return {
          content: [{
            type: "text" as const,
            text: output || "All packages are up to date.",
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
