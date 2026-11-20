import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { completeJson } from "../utils/json-output.js";
import { maskCredentials } from "../utils/confirm-param.js";
import { SERVICES, servicePort, adguardAuth, curlErrorResponse } from "../utils/service-http.js";
import { READ_ONLY } from "../utils/annotations.js";

const SERVICE = SERVICES.adguard;

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_adguardRewrites",
    {
      description: "List AdGuard Home local DNS rewrites with their domains and answers",
      inputSchema: { ...nodeParam },
      annotations: READ_ONLY,
    },
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const output = completeJson(await execSSH(
          `curl -sf ${adguardAuth(args.node)} 'http://localhost:${port}/control/rewrite/list'`,
          args.node,
        ));
        const entries: unknown = JSON.parse(output);
        if (!Array.isArray(entries) || entries.some((entry) =>
          !entry || typeof entry.domain !== "string" || typeof entry.answer !== "string",
        )) {
          throw new Error("Unexpected response from AdGuard Home /control/rewrite/list: expected DNS rewrite entries.");
        }
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        const result = curlErrorResponse(error, SERVICE, port);
        for (const item of result.content) item.text = maskCredentials(item.text);
        return result;
      }
    },
  );
}
