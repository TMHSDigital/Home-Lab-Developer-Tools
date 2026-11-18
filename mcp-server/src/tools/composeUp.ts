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
    .describe(
      "Specific compose files to start (e.g. ['compose.monitoring.yml']). Only the services they define are started; " +
        "other stacks are left as they are. " +
        "Omit for all (HOMELAB_COMPOSE_FILES, or every compose*.yml found in HOMELAB_COMPOSE_DIR).",
    ),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_composeUp",
    "Start Docker Compose stacks on the Pi",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Compose up");
      }

      try {
        // Orphan removal is only safe when the whole project is brought up.
        const cmd = args.stacks && args.stacks.length > 0
          ? buildStackCommand(["up -d $services 2>&1"], args.stacks, args.node)
          : buildComposeCommand("up -d --remove-orphans 2>&1", undefined, args.node);
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
