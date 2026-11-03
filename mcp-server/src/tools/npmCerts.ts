import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, getNpmToken, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.npm;

export function register(server: McpServer): void {
  server.tool(
    "homelab_npmCerts",
    "List SSL certificates managed by Nginx Proxy Manager with expiry dates",
    { ...nodeParam },
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const token = await getNpmToken(port, args.node);
        const output = await execSSH(
          `curl -sf -H 'Authorization: Bearer ${token}' ` +
            `'http://localhost:${port}/api/nginx/certificates'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
