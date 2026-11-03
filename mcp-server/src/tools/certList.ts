import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { SERVICES, servicePort, getNpmToken } from "../utils/service-http.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = { ...nodeParam };

const CERTBOT_MISSING = "__CERTBOT_NOT_INSTALLED__";

export function register(server: McpServer): void {
  server.tool(
    "homelab_certList",
    "List all managed SSL certificates from certbot and Nginx Proxy Manager",
    inputSchema,
    async (args) => {
      const sections: string[] = [];

      try {
        // One round trip: check for certbot and list certificates together.
        const certbotOutput = await execSSH(
          `if command -v certbot >/dev/null 2>&1; then sudo certbot certificates 2>&1; ` +
            `else echo '${CERTBOT_MISSING}'; fi`,
          args.node,
        );

        if (certbotOutput.trim() === CERTBOT_MISSING) {
          sections.push("=== Certbot ===\nNot installed. Skipping.");
        } else {
          sections.push("=== Certbot Certificates ===\n" + certbotOutput);
        }
      } catch (error) {
        if (!(error instanceof CommandFailedError)) {
          // Unknown node, unreachable host, or auth failure: report the cause.
          return errorResponse(error);
        }
        sections.push(`=== Certbot ===\nFailed to query certbot certificates: ${error.message}`);
      }

      try {
        const npmPort = servicePort(SERVICES.npm, args.node);
        const token = await getNpmToken(npmPort, args.node);

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
