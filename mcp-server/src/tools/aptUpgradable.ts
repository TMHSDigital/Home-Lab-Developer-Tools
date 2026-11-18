import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = { ...nodeParam };

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_aptUpgradable",
    {
      description: "List upgradable packages with current and candidate versions",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH(
          "apt list --upgradable 2>/dev/null | grep -v '^Listing'",
          args.node,
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
