import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";

const DEFAULT_PORT = 9090;
const SERVICE_NAME = "Prometheus";

const inputSchema = {
  query: z.string().min(1).describe("PromQL expression to evaluate"),
  time: z
    .string()
    .optional()
    .describe("Evaluation timestamp (RFC3339 or Unix). Defaults to current time"),
};

function getPort(): number {
  const override = process.env.HOMELAB_PROMETHEUS_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_prometheusQuery",
    "Run a PromQL query against Prometheus and return the result",
    inputSchema,
    async (args) => {
      const port = getPort();
      try {
        const encoded = encodeURIComponent(args.query);
        const timeParam = args.time ? `&time=${encodeURIComponent(args.time)}` : "";
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/v1/query?query=${encoded}${timeParam}'`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not reach ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_PROMETHEUS_PORT if using a non-default port.`,
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
