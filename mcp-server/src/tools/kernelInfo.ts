import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { fanOut, nodeOrAllParam } from "../utils/fan-out.js";
import { sectionScript } from "../utils/section-script.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = { ...nodeOrAllParam };

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_kernelInfo",
    {
      description: "Show kernel version, boot parameters, and loaded modules",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (input) =>
      fanOut(input.node, async (node) => {
        const args = { ...input, node };
        try {
          const cmd = sectionScript([
            ["Kernel", "uname -a"],
            ["Boot Parameters", "cat /proc/cmdline"],
            ["Loaded Modules (top 30)", "lsmod | head -31"],
          ]);
          const output = await execSSH(cmd, args.node);
          return { content: [{ type: "text" as const, text: output }] };
        } catch (error) {
          return errorResponse(error);
        }
      }),
  );
}
