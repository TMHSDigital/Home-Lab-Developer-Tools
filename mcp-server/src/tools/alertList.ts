import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.alertmanager;

const inputSchema = {
  ...nodeParam,
  state: z
    .enum(["active", "suppressed", "unprocessed"])
    .optional()
    .describe("Filter alerts by state. Returns all states if omitted"),
};

/**
 * Alertmanager v2 GET /api/v2/alerts has no `state` parameter (unknown
 * params are ignored); filtering uses these boolean flags instead.
 */
export const STATE_FILTERS: Record<"active" | "suppressed" | "unprocessed", string> = {
  active: "active=true&silenced=false&inhibited=false&unprocessed=false",
  suppressed: "active=false&silenced=true&inhibited=true&unprocessed=false",
  unprocessed: "active=false&silenced=false&inhibited=false&unprocessed=true",
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_alertList",
    "List alerts from Alertmanager, optionally filtered by state",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const stateParam = args.state ? `?${STATE_FILTERS[args.state]}` : "";
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/v2/alerts${stateParam}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
