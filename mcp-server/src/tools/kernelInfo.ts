import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {};

export function register(server: McpServer): void {
  server.tool(
    "homelab_kernelInfo",
    "Show kernel version, boot parameters, and loaded modules",
    inputSchema,
    async () => {
      try {
        const cmd = [
          "echo '=== Kernel ==='",
          "uname -a",
          "echo",
          "echo '=== Boot Parameters ==='",
          "cat /proc/cmdline",
          "echo",
          "echo '=== Loaded Modules (top 30) ==='",
          "lsmod | head -31",
        ].join(" && ");
        const output = await execSSH(cmd);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
