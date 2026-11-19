import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { forNodes, nodeOrAllParam } from "../utils/fan-out.js";
import { sectionScript, CPU_TEMP_COMMAND } from "../utils/section-script.js";
import { READ_ONLY } from "../utils/annotations.js";

export const STATUS_COMMAND = sectionScript([
  ["Uptime", "uptime"],
  ["CPU Temperature", CPU_TEMP_COMMAND],
  ["Memory", "free -h | head -2"],
  ["Disk", "df -h / | tail -1"],
  [
    "Throttle Status",
    "if command -v vcgencmd >/dev/null 2>&1; then vcgencmd get_throttled; else echo 'N/A'; fi",
  ],
]);

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
