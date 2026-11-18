import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { forNodes, nodeOrAllParam } from "../utils/fan-out.js";

const inputSchema = {
  ...nodeOrAllParam,
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

/** Container table and problem summary for one node. */
async function healthReport(service: string | undefined, node: string | undefined): Promise<string> {
  const filter = service ? `--filter 'name=${service.replace(/'/g, "'\\''")}'` : "";
  const ps = await execSSH(`docker ps -a ${filter} --format '{{json .}}'`, node);

  if (ps.startsWith("[dry-run]")) return ps;
  const containers = ps.trim()
    ? ps.trim().split("\n").map((line) => containerSchema.parse(JSON.parse(line)))
    : [];
  if (containers.length === 0) {
    return service ? `No containers matched "${service}".` : "No containers found.";
  }

  // Use one snapshot so the table and its summary describe the same set.
  const problems = containers.filter(
    (c) => c.State !== "running" || /\((unhealthy|health: starting)\)/.test(c.Status),
  );
  const text = ["NAMES\tSTATUS\tPORTS", ...containers.map((c) => `${c.Names}\t${c.Status}\t${c.Ports}`)].join("\n");
  return problems.length > 0
    ? `${text}\n\nContainers needing attention: ${problems.map((c) => c.Names).join(", ")}`
    : `${text}\n\nNo container problems detected.`;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_serviceHealth",
    'Check Docker container health status on the Pi, or on every node with node: "all"',
    inputSchema,
    async (args) => forNodes(args.node, (node) => healthReport(args.service, node)),
  );
}
