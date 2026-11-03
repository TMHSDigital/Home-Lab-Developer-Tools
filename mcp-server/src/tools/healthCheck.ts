import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = { ...nodeParam };

interface CheckResult {
  name: string;
  status: "pass" | "fail";
  detail: string;
}

/** Checks run on the node in a single SSH round trip. Commands are constants. */
const CHECKS: Array<[name: string, command: string]> = [
  ["Docker", "docker --version"],
  ["Docker Compose", "docker compose version"],
  ["curl", "command -v curl"],
  ["restic", "command -v restic"],
  ["certbot", "command -v certbot"],
  ["systemd", "systemctl --version"],
];

const MARK = "@@CHECK";

export function buildHealthCheckScript(): string {
  return CHECKS.map(
    ([name, cmd]) =>
      `if out=$( { ${cmd}; } 2>&1 ); then s=pass; else s=fail; fi; ` +
      `printf '%s|%s|%s|%s\\n' '${MARK}' "$s" '${name}' "$(printf '%s' "$out" | head -1)"`,
  ).join("; ") + "; true";
}

export function parseHealthCheckOutput(output: string): CheckResult[] {
  const results: CheckResult[] = [];
  for (const line of output.split("\n")) {
    if (!line.startsWith(`${MARK}|`)) continue;
    const rest = line.slice(MARK.length + 1);
    const [status, name, ...detail] = rest.split("|");
    if (status !== "pass" && status !== "fail") continue;
    const text = detail.join("|").trim();
    results.push({
      name,
      status,
      detail: text || (status === "pass" ? "ok" : "not available"),
    });
  }
  return results;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_healthCheck",
    "Comprehensive self-test: SSH connectivity, Docker, required tools",
    inputSchema,
    async (args) => {
      let output: string;
      try {
        output = await execSSH(buildHealthCheckScript(), args.node);
      } catch (error) {
        // Every check depends on SSH; report the cause and stop.
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        const base = errorResponse(error);
        return {
          ...base,
          content: [{
            type: "text" as const,
            text: `[FAIL] SSH connectivity: ${reason}\n\nRemaining checks skipped.`,
          }],
        };
      }

      const parsed = parseHealthCheckOutput(output);
      if (parsed.length === 0) {
        // For example dry-run mode: show what would have run.
        return { content: [{ type: "text" as const, text: output }] };
      }

      const checks: CheckResult[] = [
        { name: "SSH connectivity", status: "pass", detail: "ok" },
        ...parsed,
      ];
      const passed = checks.filter((c) => c.status === "pass").length;
      const lines = checks.map(
        (c) => `[${c.status === "pass" ? "PASS" : "FAIL"}] ${c.name}: ${c.detail}`,
      );
      lines.push("", `${passed}/${checks.length} checks passed`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );
}
