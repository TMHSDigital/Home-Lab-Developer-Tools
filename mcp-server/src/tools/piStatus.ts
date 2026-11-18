import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { forNodes, nodeOrAllParam } from "../utils/fan-out.js";
import { READ_ONLY } from "../utils/annotations.js";

const STATUS_COMMAND = [
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
].join(" && ");

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_piStatus",
    {
      description: 'Get Raspberry Pi system status: CPU temp, memory, disk, uptime, and throttle state (node: "all" for every node)',
      inputSchema: { ...nodeOrAllParam },
      annotations: READ_ONLY,
    },
    async (args) => forNodes(args.node, (node) => execSSH(STATUS_COMMAND, node)),
  );
}
