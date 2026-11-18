import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { forNodes } from "../utils/fan-out.js";
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
      const cmd = [
        'echo "=== Uptime ==="',
        "uptime",
        'echo ""',
        'echo "=== CPU Temperature ==="',
        "cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{printf \"%.1f C\\n\", $1/1000}' || echo 'N/A'",
        'echo ""',
        'echo "=== Memory ==="',
        "free -h | head -2",
        'echo ""',
        'echo "=== Disk ==="',
        "df -h / | tail -1",
      ].join(" && ");

      return forNodes(args.node, (node) => execSSH(cmd, node));
    },
  );
}
