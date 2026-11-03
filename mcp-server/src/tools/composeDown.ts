import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { buildComposeCommand } from "../utils/compose.js";

const inputSchema = {
  ...nodeParam,
  stacks: z
    .array(z.string())
    .optional()
    .describe("Specific compose files to stop. Omit for all."),
  removeVolumes: z
    .boolean()
    .optional()
    .default(false)
    .describe("Also remove named volumes declared in compose file"),
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
        const volFlag = args.removeVolumes ? " -v" : "";
        const output = await execSSH(
          buildComposeCommand(`down${volFlag} 2>&1`, args.stacks),
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
