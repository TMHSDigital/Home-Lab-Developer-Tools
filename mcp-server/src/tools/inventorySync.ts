import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, nodeSetting } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  source: z
    .enum(["ansible", "tailscale"])
    .describe("Discovery source: 'ansible' reads inventory file, 'tailscale' queries Tailscale peers"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_inventorySync",
    {
      description: "Discover nodes from Ansible inventory or Tailscale network",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        if (args.source === "ansible") {
          const inventoryPath =
            nodeSetting(args.node, "HOMELAB_ANSIBLE_INVENTORY") || "/etc/ansible/hosts";
          const cmd =
            `if [ ! -e '${inventoryPath}' ]; then echo 'Inventory file not found at ${inventoryPath}. Set HOMELAB_ANSIBLE_INVENTORY to the correct path.'; ` +
            `elif [ ! -r '${inventoryPath}' ]; then echo 'Inventory file ${inventoryPath} exists but is not readable by the SSH user.' >&2; exit 1; ` +
            `else cat '${inventoryPath}'; fi`;
          const output = await execSSH(cmd, args.node);
          return {
            content: [{
              type: "text" as const,
              text: `=== Ansible Inventory (${inventoryPath}) ===\n${output}`,
            }],
          };
        }

        // Only a missing binary is reported as "not installed"; a stopped or
        // logged-out daemon keeps its own message (and exit status).
        const cmd =
          "if ! command -v tailscale >/dev/null 2>&1; then echo 'Tailscale is not installed or not in PATH.'; " +
          "else tailscale status 2>&1; fi";
        const output = await execSSH(cmd, args.node);
        return {
          content: [{
            type: "text" as const,
            text: `=== Tailscale Peers ===\n${output}`,
          }],
        };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
