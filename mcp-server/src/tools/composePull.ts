import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { buildComposeCommand, buildStackCommand } from "../utils/compose.js";
import { changesState } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  stacks: z
    .array(z.string())
    .optional()
    .describe("Specific compose files to pull images for (only their services). Omit for all."),
};

// Intentionally ungated: pull only downloads images, does not change running state.
export function register(server: McpServer): void {
  server.registerTool(
    "homelab_composePull",
    {
      description: "Pull latest Docker images for compose stacks on the Pi",
      inputSchema,
      annotations: changesState(true),
    },
    async (args) => {
      try {
        const command =
          args.stacks && args.stacks.length > 0
            ? buildStackCommand(["pull $services 2>&1"], args.stacks, args.node)
            : buildComposeCommand("pull 2>&1", args.node);
        const output = await execSSH(
          command,
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
