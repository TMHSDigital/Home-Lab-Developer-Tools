import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { destructive } from "../utils/annotations.js";

export const UNIT_RE = /^[A-Za-z0-9@._:-]+$/;

const ACTIONS = ["start", "stop", "restart", "reload", "enable", "disable"] as const;
type Action = (typeof ACTIONS)[number];

/** Units whose stop/disable would cut off the SSH connection every tool depends on. */
const SSH_UNITS = new Set(["ssh", "sshd", "ssh.service", "sshd.service", "ssh.socket", "sshd.socket"]);

const inputSchema = {
  ...nodeParam,
  unit: z
    .string()
    .min(1)
    .max(256)
    .regex(UNIT_RE, "Unit names may contain only letters, digits, '@', '.', '_', ':' and '-'")
    .describe("systemd unit name (e.g. smbd, cockpit.socket, restic-backup.timer)"),
  action: z.enum(ACTIONS).describe("What to do with the unit"),
  ...confirmParam,
};

/** The command run for a confirmed call; prints the unit's state afterwards. */
export function systemdControlCommand(unit: string, action: Action): string {
  return (
    `sudo systemctl ${action} '${unit}' && ` +
    `echo "active: $(systemctl is-active '${unit}')" && ` +
    `echo "enabled: $(systemctl is-enabled '${unit}' 2>/dev/null)"`
  );
}

/** Refuse actions that would lock the caller out of the node. */
export function lockoutRefusal(unit: string, action: Action): string | null {
  if ((action === "stop" || action === "disable") && SSH_UNITS.has(unit)) {
    return `Refusing to ${action} ${unit}: it would cut off the SSH connection this server uses. Use the node's console instead.`;
  }
  return null;
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_systemdControl",
    {
      description:
        "Start, stop, restart, reload, enable or disable a native systemd unit on the node (requires confirm=true); reports the unit's state afterwards",
      inputSchema,
      annotations: destructive(true),
    },
    async (args) => {
      const refusal = lockoutRefusal(args.unit, args.action);
      if (refusal) {
        return { content: [{ type: "text" as const, text: refusal }], isError: true };
      }
      const command = systemdControlCommand(args.unit, args.action);
      if (!args.confirm) {
        return confirmCancelled(`systemctl ${args.action}`, {
          node: args.node,
          commands: () => [command],
          note: "Afterwards it reports whether the unit is active and enabled.",
        });
      }

      try {
        const output = await execSSH(command, args.node);
        return {
          content: [{
            type: "text" as const,
            text: `systemctl ${args.action} ${args.unit} done.\n${output}`,
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
