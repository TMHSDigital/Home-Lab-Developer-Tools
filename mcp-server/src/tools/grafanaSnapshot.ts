import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, grafanaAuth, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.grafana;

const inputSchema = {
  ...nodeParam,
  dashboard: z.string().min(1).describe("Dashboard UID to export"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_grafanaSnapshot",
    "Export a Grafana dashboard configuration by UID",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const auth = grafanaAuth(args.node);
        const output = await execSSH(
          `curl -sf ${auth} 'http://localhost:${port}/api/dashboards/uid/${args.dashboard}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port, {
          httpError:
            `${SERVICE.name} returned an HTTP error. ${SERVICE.authHint} ` +
            `Also verify the dashboard UID "${args.dashboard}" exists, and that port ${port} is Grafana ` +
            `(AdGuard Home also defaults to 3000; set HOMELAB_GRAFANA_PORT if needed).`,
        });
      }
    },
  );
}
