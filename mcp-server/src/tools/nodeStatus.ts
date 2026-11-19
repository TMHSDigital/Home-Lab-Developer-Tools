import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { forNodes } from "../utils/fan-out.js";
import { sectionScript, CPU_TEMP_COMMAND } from "../utils/section-script.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  node: z.string().min(1).describe('Target node name from the node registry, or "all" for every node in one call'),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_nodeStatus",
    {
      description: 'Get system status for a specific node, or every node with node: "all" (uptime, CPU, memory, disk)',
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      const cmd = sectionScript([
        ["Uptime", "uptime"],
        ["CPU Temperature", CPU_TEMP_COMMAND],
        ["Memory", "free -h | head -2"],
        ["Disk", "df -h / | tail -1"],
      ]);

      return forNodes(args.node, (node) => execSSH(cmd, node));
    },
  );
}
