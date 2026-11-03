import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.prometheus;

const inputSchema = {
  ...nodeParam,
  query: z.string().min(1).describe("PromQL expression to evaluate"),
  time: z
    .string()
    .optional()
    .describe("Evaluation timestamp (RFC3339 or Unix). Defaults to current time"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_prometheusQuery",
    "Run a PromQL query against Prometheus and return the result",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const encoded = encodeURIComponent(args.query);
        const timeParam = args.time ? `&time=${encodeURIComponent(args.time)}` : "";
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/v1/query?query=${encoded}${timeParam}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port, {
          httpError: `${SERVICE.name} on port ${port} returned an HTTP error. Check the PromQL expression and time value.`,
        });
      }
    },
  );
}
