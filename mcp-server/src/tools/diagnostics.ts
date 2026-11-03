import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = { ...nodeParam };

/** Sections collected in a single SSH round trip. Commands are constants. */
const SECTIONS: Array<[label: string, command: string]> = [
  ["OS", "head -5 /etc/os-release"],
  ["Kernel", "uname -a"],
  ["Docker", "docker --version"],
  ["Containers", "docker ps --format 'table {{.Names}}\\t{{.Status}}'"],
  ["Memory", "free -h"],
  ["Disk", "df -h /"],
  ["Uptime", "uptime"],
  ["Node.js", "node --version 2>/dev/null || echo 'not installed'"],
  ["Network", "ip -brief addr 2>/dev/null || ifconfig 2>/dev/null || echo 'N/A'"],
];

/**
 * Build one remote script that prints every section. A failing section
 * prints "(unavailable: <first error line>)" without aborting the rest.
 */
export function buildDiagnosticsScript(): string {
  const parts = SECTIONS.map(
    ([label, cmd]) =>
      `echo '=== ${label} ==='; ` +
      `if ! out=$( { ${cmd}; } 2>&1 ); then ` +
      `echo "(unavailable: $(printf '%s' "$out" | head -1))"; ` +
      `else printf '%s\\n' "$out"; fi; echo`,
  );
  return parts.join("; ") + "; true";
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_diagnostics",
    "Collect debug info bundle: OS, kernel, Docker, memory, disk, network",
    inputSchema,
    async (args) => {
      try {
        // One connection for all sections. If the node is unknown,
        // unreachable, or rejects auth, the real error is returned.
        const output = await execSSH(buildDiagnosticsScript(), args.node);
        return {
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
