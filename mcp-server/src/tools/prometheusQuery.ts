import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";
import { completeJson } from "../utils/json-output.js";
import { READ_ONLY } from "../utils/annotations.js";

const SERVICE = SERVICES.prometheus;

const inputSchema = {
  ...nodeParam,
  query: z.string().min(1).describe("PromQL expression to evaluate"),
  time: z
    .string()
    .optional()
    .describe("Evaluation timestamp (RFC3339 or Unix). Defaults to current time"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe("Maximum number of result series to return (default 100, max 1000)"),
};

/**
 * Keep at most `limit` series of a vector or matrix result. The response stays
 * valid JSON; a "note" field says how many series were left out.
 */
export function limitSeries(json: string, limit: number): string {
  let body: { data?: { result?: unknown } } & Record<string, unknown>;
  try {
    body = JSON.parse(json);
  } catch {
    return json;
  }
  const result = body?.data?.result;
  if (!Array.isArray(result) || result.length <= limit) return json;
  body.data!.result = result.slice(0, limit);
  body.note = `Showing the first ${limit} of ${result.length} series. Narrow the query or raise limit.`;
  return JSON.stringify(body);
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_prometheusQuery",
    {
      description: "Run a PromQL query against Prometheus and return the result",
      inputSchema,
      annotations: READ_ONLY,
    },
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

        const text = limitSeries(completeJson(output), args.limit ?? 100);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port, {
          httpError: `${SERVICE.name} on port ${port} returned an HTTP error. Check the PromQL expression and time value.`,
        });
      }
    },
  );
}
