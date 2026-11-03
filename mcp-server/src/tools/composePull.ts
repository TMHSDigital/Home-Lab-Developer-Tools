import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { buildComposeCommand } from "../utils/compose.js";

const inputSchema = {
  ...nodeParam,
  stacks: z
    .array(z.string())
    .optional()
    .describe("Specific compose files to pull images for. Omit for all."),
};

// Intentionally ungated: pull only downloads images, does not change running state.
export function register(server: McpServer): void {
  server.tool(
    "homelab_composePull",
    "Pull latest Docker images for compose stacks on the Pi",
    inputSchema,
    async (args) => {
      try {
        const output = await execSSH(
          buildComposeCommand("pull 2>&1", args.stacks),
          args.node,
          { timeoutMs: TIMEOUTS.long },
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
