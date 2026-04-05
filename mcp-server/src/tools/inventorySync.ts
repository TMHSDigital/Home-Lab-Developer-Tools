import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  source: z
    .enum(["ansible", "tailscale"])
    .describe("Discovery source: 'ansible' reads inventory file, 'tailscale' queries Tailscale peers"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_inventorySync",
    "Discover nodes from Ansible inventory or Tailscale network",
    inputSchema,
    async (args) => {
      try {
        if (args.source === "ansible") {
          const inventoryPath =
            process.env.HOMELAB_ANSIBLE_INVENTORY || "/etc/ansible/hosts";
          const cmd =
            `test -f '${inventoryPath}' && cat '${inventoryPath}' || echo 'Inventory file not found at ${inventoryPath}. Set HOMELAB_ANSIBLE_INVENTORY to the correct path.'`;
          const output = await execSSH(cmd);
          return {
            content: [{
              type: "text" as const,
              text: `=== Ansible Inventory (${inventoryPath}) ===\n${output}`,
            }],
          };
        }

        const cmd =
          "command -v tailscale >/dev/null 2>&1 && tailscale status 2>&1 || echo 'Tailscale is not installed or not in PATH.'";
        const output = await execSSH(cmd);
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
