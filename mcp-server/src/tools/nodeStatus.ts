import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  node: z.string().min(1).describe("Target node name from the node registry"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_nodeStatus",
    "Get system status for a specific node (uptime, CPU, memory, disk)",
    inputSchema,
    async (args) => {
      try {
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

        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
