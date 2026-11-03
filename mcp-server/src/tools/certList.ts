import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = { ...nodeParam };

export function register(server: McpServer): void {
  server.tool(
    "homelab_certList",
    "List all managed SSL certificates from certbot and Nginx Proxy Manager",
    inputSchema,
    async (args) => {
      const sections: string[] = [];

      try {
        const certbotCheck = await execSSH(
          "command -v certbot >/dev/null 2>&1 && echo 'installed' || echo 'missing'",
          args.node,
        );

        if (certbotCheck.trim() === "installed") {
          const certbotOutput = await execSSH("sudo certbot certificates 2>&1", args.node);
          sections.push("=== Certbot Certificates ===\n" + certbotOutput);
        } else {
          sections.push("=== Certbot ===\nNot installed. Skipping.");
        }
      } catch (error) {
        if (!(error instanceof CommandFailedError)) {
          // Unknown node, unreachable host, or auth failure: report the cause.
          return errorResponse(error);
        }
        sections.push(`=== Certbot ===\nFailed to query certbot certificates: ${error.message}`);
      }

      try {
        const npmPort = process.env.HOMELAB_NPM_PORT
          ? parseInt(process.env.HOMELAB_NPM_PORT, 10)
          : 81;
        const email = process.env.HOMELAB_NPM_EMAIL || "admin@example.com";
        const password = process.env.HOMELAB_NPM_PASSWORD || "changeme";
        const payload = JSON.stringify({ identity: email, secret: password });

        const tokenOutput = await execSSH(
          `curl -sf -X POST -H 'Content-Type: application/json' ` +
            `-d '${payload}' 'http://localhost:${npmPort}/api/tokens'`,
          args.node,
        );
        const token = JSON.parse(tokenOutput).token;

        const certsOutput = await execSSH(
          `curl -sf -H 'Authorization: Bearer ${token}' ` +
            `'http://localhost:${npmPort}/api/nginx/certificates'`,
          args.node,
        );
        sections.push("\n=== Nginx Proxy Manager Certificates ===\n" + certsOutput);
      } catch (error) {
        const reason =
          error instanceof SyntaxError
            ? "unexpected response from the NPM API"
            : error instanceof Error
              ? error.message
              : String(error);
        sections.push(
          "\n=== Nginx Proxy Manager ===\nCould not query NPM certificates " +
            `(${reason}). Check HOMELAB_NPM_PORT and credentials.`,
        );
      }

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    },
  );
}
