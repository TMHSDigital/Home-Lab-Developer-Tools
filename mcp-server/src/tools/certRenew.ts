import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";

const inputSchema = {
  ...nodeParam,
  domain: z
    .string()
    .optional()
    .describe("Specific certificate name to renew. Renews all eligible certificates if omitted"),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_certRenew",
    "Trigger Let's Encrypt certificate renewal via certbot",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Renewal");
      }

      try {
        const certbotCheck = await execSSH(
          "command -v certbot >/dev/null 2>&1 && echo 'installed' || echo 'missing'",
          args.node,
        );

        if (certbotCheck.trim() === "missing") {
          return {
            content: [{
              type: "text" as const,
              text: "certbot is not installed on the Pi. Install it with:\n\n" +
                "sudo apt install -y certbot\n\n" +
                "If using Nginx Proxy Manager, certificates are managed through NPM's UI instead.",
            }],
          };
        }

        const cmd = args.domain
          ? `sudo certbot renew --cert-name '${args.domain}' --force-renewal 2>&1`
          : "sudo certbot renew 2>&1";
        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
