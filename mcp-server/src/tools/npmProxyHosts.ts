import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const DEFAULT_PORT = 81;
const SERVICE_NAME = "Nginx Proxy Manager";

function getPort(): number {
  const override = process.env.HOMELAB_NPM_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

function getCredentials(): { email: string; password: string } {
  return {
    email: process.env.HOMELAB_NPM_EMAIL || "admin@example.com",
    password: process.env.HOMELAB_NPM_PASSWORD || "changeme",
  };
}

async function getNpmToken(port: number, node?: string): Promise<string> {
  const { email, password } = getCredentials();
  const payload = JSON.stringify({ identity: email, secret: password });
  const output = await execSSH(
    `curl -sf -X POST -H 'Content-Type: application/json' ` +
      `-d '${payload}' 'http://localhost:${port}/api/tokens'`,
    node,
  );
  const parsed = JSON.parse(output);
  return parsed.token;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_npmProxyHosts",
    "List all Nginx Proxy Manager proxy host configurations",
    { ...nodeParam },
    async (args) => {
      const port = getPort();
      try {
        const token = await getNpmToken(port, args.node);
        const output = await execSSH(
          `curl -sf -H 'Authorization: Bearer ${token}' ` +
            `'http://localhost:${port}/api/nginx/proxy-hosts'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_NPM_PORT if using a non-default port.`,
              ),
            );
          }
          if (error.exitCode === 22) {
            return errorResponse(
              new Error(
                `${SERVICE_NAME} returned an HTTP error. Check authentication -- ` +
                  `set HOMELAB_NPM_EMAIL and HOMELAB_NPM_PASSWORD.`,
              ),
            );
          }
        }
        if (error instanceof SyntaxError) {
          return errorResponse(
            new Error(
              `Failed to parse ${SERVICE_NAME} authentication response. ` +
                `Verify HOMELAB_NPM_EMAIL and HOMELAB_NPM_PASSWORD are correct.`,
            ),
          );
        }
        return errorResponse(error);
      }
    },
  );
}
