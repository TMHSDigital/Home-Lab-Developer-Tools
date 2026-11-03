import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, adguardAuth, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.adguard;

export function register(server: McpServer): void {
  server.tool(
    "homelab_adguardFilters",
    "List AdGuard Home filter lists with name, URL, enabled status, and rule count",
    { ...nodeParam },
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const auth = adguardAuth(args.node);
        const output = await execSSH(
          `curl -sf ${auth} 'http://localhost:${port}/control/filtering/status'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
