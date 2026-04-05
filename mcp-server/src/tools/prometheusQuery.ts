import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
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
      try {
        const encoded = encodeURIComponent(args.query);
        const timeParam = args.time ? `&time=${encodeURIComponent(args.time)}` : "";
        const output = await execSSH(
          `curl -sf 'http://localhost:9090/api/v1/query?query=${encoded}${timeParam}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
