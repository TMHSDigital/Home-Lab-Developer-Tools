import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  node: z.string().min(1).describe("Target node name from the node registry"),
  command: z.string().min(1).describe("Shell command to execute on the node"),
  confirm: z
    .boolean()
    .describe("Safety gate -- must be true to execute arbitrary commands"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_nodeExec",
    "Execute a shell command on a specific node by name",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return {
          content: [{
            type: "text" as const,
            text: "Execution aborted -- set confirm=true to proceed.",
          }],
        };
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
