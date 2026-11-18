import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, adguardAuth, curlErrorResponse } from "../utils/service-http.js";
import { READ_ONLY } from "../utils/annotations.js";

const SERVICE = SERVICES.adguard;

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_adguardStats",
    {
      description: "Get AdGuard Home DNS statistics including query counts, blocked domains, and top clients",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const auth = adguardAuth(args.node);
        const output = await execSSH(
          `curl -sf ${auth} 'http://localhost:${port}/control/stats'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
