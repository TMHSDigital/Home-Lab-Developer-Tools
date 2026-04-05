import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = { ...nodeParam };

async function collect(
  label: string,
  command: string,
  node?: string,
): Promise<string> {
  try {
    const output = await execSSH(command, node);
    return `=== ${label} ===\n${output}`;
  } catch {
    return `=== ${label} ===\n(unavailable)`;
  }
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_diagnostics",
    "Collect debug info bundle: OS, kernel, Docker, memory, disk, network",
    inputSchema,
    async (args) => {
      try {
        const sections: string[] = [];

        sections.push(await collect("OS", "cat /etc/os-release | head -5", args.node));
        sections.push(await collect("Kernel", "uname -a", args.node));
        sections.push(await collect("Docker", "docker --version", args.node));
        sections.push(
          await collect(
            "Containers",
            "docker ps --format 'table {{.Names}}\\t{{.Status}}'",
            args.node,
          ),
        );
        sections.push(await collect("Memory", "free -h | head -2", args.node));
        sections.push(await collect("Disk", "df -h / | tail -1", args.node));
        sections.push(await collect("Uptime", "uptime", args.node));
        sections.push(
          await collect("Node.js", "node --version 2>/dev/null || echo 'not installed'", args.node),
        );
        sections.push(await collect("Network", "ip -brief addr 2>/dev/null || ifconfig 2>/dev/null || echo 'N/A'", args.node));

        return {
          content: [{ type: "text" as const, text: sections.join("\n\n") }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
