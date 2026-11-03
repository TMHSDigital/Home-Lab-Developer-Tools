import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.speedtest;

const inputSchema = {
  ...nodeParam,
  count: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(5)
    .describe("Number of recent speedtest results to return"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_speedtestResults",
    "Get recent speedtest results from Speedtest Tracker",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/speedtest/latest?limit=${args.count}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
