import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = { ...nodeParam };

interface CheckResult {
  name: string;
  status: "pass" | "fail";
  detail: string;
}

async function runCheck(
  name: string,
  command: string,
  node?: string,
): Promise<CheckResult> {
  try {
    const output = await execSSH(command, node);
    return { name, status: "pass", detail: output.split("\n")[0] };
  } catch {
    return { name, status: "fail", detail: "not available" };
  }
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_healthCheck",
    "Comprehensive self-test: SSH connectivity, Docker, required tools",
    inputSchema,
    async (args) => {
      try {
        const checks: CheckResult[] = [];

        checks.push(await runCheck("SSH connectivity", "echo ok", args.node));
        checks.push(await runCheck("Docker", "docker --version", args.node));
        checks.push(
          await runCheck("Docker Compose", "docker compose version", args.node),
        );
        checks.push(await runCheck("curl", "command -v curl", args.node));
        checks.push(await runCheck("restic", "command -v restic", args.node));
        checks.push(await runCheck("certbot", "command -v certbot", args.node));
        checks.push(
          await runCheck("systemd", "systemctl --version | head -1", args.node),
        );

        const passed = checks.filter((c) => c.status === "pass").length;
        const lines = checks.map(
          (c) => `[${c.status === "pass" ? "PASS" : "FAIL"}] ${c.name}: ${c.detail}`,
        );
        lines.push("", `${passed}/${checks.length} checks passed`);

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
