import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { destructive } from "../utils/annotations.js";

const inputSchema = {
  node: z.string().min(1).describe("Target node name from the node registry"),
  command: z.string().min(1).describe("Shell command to execute on the node"),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_nodeExec",
    {
      description: "Execute a shell command on a specific node by name",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Execution", { node: args.node, commands: () => [args.command] });
      }

      try {
        const output = await execSSH(args.command, args.node);
        return {
          content: [{
            type: "text" as const,
            text: output || "(command produced no output)",
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
