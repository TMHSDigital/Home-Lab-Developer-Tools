import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

export function register(server: McpServer): void {
  server.tool(
    "homelab_piStatus",
    "Get Raspberry Pi system status: CPU temp, memory, disk, uptime, and throttle state",
    {},
    async () => {
      try {
        const output = await execSSH([
          'echo "=== Uptime ==="',
          "uptime",
          'echo ""',
          'echo "=== CPU Temperature ==="',
          "cat /sys/class/thermal/thermal_zone0/temp | awk '{printf \"%.1f C\\n\", $1/1000}'",
          'echo ""',
          'echo "=== Memory ==="',
          "free -h | head -2",
          'echo ""',
          'echo "=== Disk ==="',
          "df -h / | tail -1",
          'echo ""',
          'echo "=== Throttle Status ==="',
          "vcgencmd get_throttled 2>/dev/null || echo 'N/A'",
        ].join(" && "));

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
