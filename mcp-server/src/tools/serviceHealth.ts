import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  service: z
    .string()
    .optional()
    .describe("Specific container name to check, or omit for all"),
};

const containerSchema = z.object({
  Names: z.string(),
  State: z.string(),
  Status: z.string(),
  Ports: z.string(),
});

export function register(server: McpServer): void {
  server.tool(
    "homelab_serviceHealth",
    "Check Docker container health status on the Pi",
    inputSchema,
    async (args) => {
      try {
        const filter = args.service ? `--filter 'name=${args.service.replace(/'/g, "'\\''")}'` : "";
        const ps = await execSSH(
          `docker ps -a ${filter} --format '{{json .}}'`,
          args.node,
        );

        if (ps.startsWith("[dry-run]")) {
          return { content: [{ type: "text" as const, text: ps }] };
        }
        const containers = ps.trim() ? ps.trim().split("\n").map(
          (line) => containerSchema.parse(JSON.parse(line)),
        ) : [];
        if (containers.length === 0) {
          const text = args.service ? `No containers matched "${args.service}".` : "No containers found.";
          return { content: [{ type: "text" as const, text }] };
        }

        // Use one snapshot so the table and its summary describe the same set.
        const problems = containers.filter(
          (c) => c.State !== "running" || /\((unhealthy|health: starting)\)/.test(c.Status),
        );
        let text = ["NAMES\tSTATUS\tPORTS", ...containers.map(
          (c) => `${c.Names}\t${c.Status}\t${c.Ports}`,
        )].join("\n");
        if (problems.length > 0) {
          text += `\n\nContainers needing attention: ${problems.map((c) => c.Names).join(", ")}`;
        } else {
          text += "\n\nNo container problems detected.";
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
