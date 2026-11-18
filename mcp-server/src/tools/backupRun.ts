import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, nodeSetting, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { destructive } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  ...confirmParam,
};

export const DEFAULT_BACKUP_SCRIPT = "/opt/backup/backup.sh";
const SCRIPT_RE = /^\/[A-Za-z0-9._\/-]+$/;

/** Backup script for a node (HOMELAB_BACKUP_SCRIPT, per-node overridable). */
export function backupScript(node?: string): string {
  const script = nodeSetting(node, "HOMELAB_BACKUP_SCRIPT") || DEFAULT_BACKUP_SCRIPT;
  if (!SCRIPT_RE.test(script)) {
    throw new Error(
      "HOMELAB_BACKUP_SCRIPT must be an absolute path on the node (letters, digits, '.', '_', '-', '/').",
    );
  }
  return script;
}

// Check for the script separately so "not found" is only reported when it is
// actually missing. A failing backup exits non-zero and surfaces as an error
// with the tail of its output. The path is validated, so quoting is enough.
export function backupCommand(node?: string): string {
  const script = backupScript(node);
  return (
    `if ! sudo test -x '${script}'; then ` +
    `echo 'Backup script not found or not executable at ${script}. Set HOMELAB_BACKUP_SCRIPT.' >&2; exit 127; fi; ` +
    `out=$(sudo '${script}' 2>&1); rc=$?; ` +
    `if [ "$rc" -ne 0 ]; then printf '%s\\n' "$out" | tail -40 >&2; exit "$rc"; fi; ` +
    `printf '%s\\n' "$out"`
  );
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupRun",
    {
      description: "Trigger a restic backup on the Pi by running its backup script (HOMELAB_BACKUP_SCRIPT)",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Backup", { node: args.node, commands: () => [backupCommand(args.node)] });
      }

      try {
        const output = await execSSH(backupCommand(args.node), args.node, { timeoutMs: TIMEOUTS.backup });

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
