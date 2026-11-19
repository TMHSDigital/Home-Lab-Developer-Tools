import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { fanOut, nodeOrAllParam } from "../utils/fan-out.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = { ...nodeOrAllParam };

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_aptUpgradable",
    {
      description: "List upgradable packages with current and candidate versions",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (input) =>
      fanOut(input.node, async (node) => {
        const args = { ...input, node };
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
      }),
  );
}
