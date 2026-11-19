import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { buildComposeCommand, buildStackCommand } from "../utils/compose.js";
import { destructive } from "../utils/annotations.js";

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

function upCommand(stacks: string[] | undefined, node?: string): string {
  // Orphan removal is only safe when the whole project is brought up.
  return stacks && stacks.length > 0
    ? buildStackCommand(["up -d $services 2>&1"], stacks, node)
    : buildComposeCommand("up -d --remove-orphans 2>&1", node);
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_composeUp",
    {
      description: "Start Docker Compose stacks on the Pi",
      inputSchema,
      annotations: destructive(true),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Compose up", { node: args.node, commands: () => [upCommand(args.stacks, args.node)] });
      }

      try {
        const output = await execSSH(
          upCommand(args.stacks, args.node),
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
