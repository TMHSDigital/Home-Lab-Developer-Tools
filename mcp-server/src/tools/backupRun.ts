import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";

const inputSchema = {
  ...nodeParam,
  ...confirmParam,
};

const BACKUP_SCRIPT = "/opt/backup/backup.sh";

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupRun",
    "Trigger a restic backup on the Pi",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Backup");
      }

      try {
        // Check for the script separately so "not found" is only reported
        // when it is actually missing. A failing backup exits non-zero and
        // surfaces as an error with the tail of its output.
        const output = await execSSH(
          `if ! sudo test -x ${BACKUP_SCRIPT}; then ` +
            `echo 'Backup script not found or not executable at ${BACKUP_SCRIPT}' >&2; exit 127; fi; ` +
            `out=$(sudo ${BACKUP_SCRIPT} 2>&1); rc=$?; ` +
            `if [ "$rc" -ne 0 ]; then printf '%s\\n' "$out" | tail -40 >&2; exit "$rc"; fi; ` +
            `printf '%s\\n' "$out"`,
          args.node,
          { timeoutMs: TIMEOUTS.backup },
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
