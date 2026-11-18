import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { buildComposeCommand, buildStackCommand } from "../utils/compose.js";

const inputSchema = {
  ...nodeParam,
  stacks: z
    .array(z.string())
    .optional()
    .describe("Specific compose files whose services to stop and remove. Omit to bring the whole project down."),
  removeVolumes: z
    .boolean()
    .optional()
    .default(false)
    .describe("Also remove named volumes declared in the compose files (only without stacks)"),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_composeDown",
    "Stop Docker Compose stacks on the Pi",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Compose down");
      }

      try {
        const subset = args.stacks && args.stacks.length > 0;
        if (subset && args.removeVolumes) {
          return errorResponse(
            new Error(
              "removeVolumes is only supported when stopping all stacks: named volumes belong " +
                "to the whole Compose project. Omit stacks, or remove the volume explicitly.",
            ),
          );
        }
        const volFlag = args.removeVolumes ? " -v" : "";
        // `down` with a subset of files would also stop base services and
        // treat other stacks as orphans; stop and remove only this stack's.
        const cmd = subset
          ? buildStackCommand(["stop $services 2>&1", "rm -f $services 2>&1"], args.stacks!, args.node)
          : buildComposeCommand(`down${volFlag} 2>&1`, undefined, args.node);
        const output = await execSSH(
          cmd,
          args.node,
          { timeoutMs: TIMEOUTS.medium },
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
