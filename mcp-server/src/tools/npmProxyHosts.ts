import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completeJson } from "../utils/json-output.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, npmGet, curlErrorResponse } from "../utils/service-http.js";
import { READ_ONLY } from "../utils/annotations.js";

const SERVICE = SERVICES.npm;

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_npmProxyHosts",
    {
      description: "List all Nginx Proxy Manager proxy host configurations",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const output = await npmGet("/nginx/proxy-hosts", port, args.node);

        return { content: [{ type: "text" as const, text: completeJson(output) }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
