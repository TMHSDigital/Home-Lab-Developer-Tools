import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, adguardAuth, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.adguard;

const inputSchema = {
  ...nodeParam,
  search: z
    .string()
    .optional()
    .describe("Filter queries by domain or client IP"),
  count: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .default(25)
    .describe("Number of recent queries to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_adguardQueryLog",
    "Search the AdGuard Home DNS query log",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const auth = adguardAuth(args.node);
        const params: string[] = [`limit=${args.count}`];
        if (args.search) {
          params.push(`search=${encodeURIComponent(args.search)}`);
        }
        const query = params.join("&");
        const output = await execSSH(
          `curl -sf ${auth} 'http://localhost:${port}/control/querylog?${query}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
