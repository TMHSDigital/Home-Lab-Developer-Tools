import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { CommandFailedError } from "../utils/errors.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  domain: z
    .string()
    .min(1)
    .describe("Domain or host:port to check SSL certificate for (e.g. 'example.com' or 'example.com:8443')"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_certCheck",
    {
      description: "Check SSL certificate expiry, issuer, and fingerprint for a domain",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      const unavailable = `Could not retrieve certificate for ${args.domain}. Verify the host is reachable and serving TLS.`;
      try {
        const target = args.domain.includes(":") ? args.domain : `${args.domain}:443`;
        const serverName = args.domain.split(":")[0];
        const cmd =
          `echo | openssl s_client -servername '${serverName}' -connect '${target}' 2>/dev/null ` +
          `| openssl x509 -noout -subject -issuer -dates -fingerprint 2>&1`;
        const output = await execSSH(cmd, args.node);
        return {
          content: [{
            type: "text" as const,
            text: output || unavailable,
          }],
        };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          return {
            content: [{ type: "text" as const, text: `${unavailable}\n\n${error.message}` }],
            isError: true,
          };
        }
        return errorResponse(error);
      }
    },
  );
}
