import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { completeJson } from "../utils/json-output.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, adguardAuth, curlErrorResponse } from "../utils/service-http.js";
import { READ_ONLY } from "../utils/annotations.js";

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
  server.registerTool(
    "homelab_adguardQueryLog",
    {
      description: "Search the AdGuard Home DNS query log",
      inputSchema,
      annotations: READ_ONLY,
    },
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

        return { content: [{ type: "text" as const, text: completeJson(output) }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
