import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, listNodes, errorResponse } from "../utils/ssh-api.js";
import { READ_ONLY } from "../utils/annotations.js";
import { DryRunError } from "../utils/errors.js";

const inputSchema = {};

const PROBE_TIMEOUT_MS = 15_000;

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_nodeList",
    {
      description: "List all managed nodes and their connection status",
      inputSchema,
      annotations: READ_ONLY,
    },
    async () => {
      let nodes: { name: string; host: string; port: number }[];
      try {
        nodes = listNodes();
      } catch (error) {
        // Invalid HOMELAB_NODES: report it instead of hiding the nodes.
        return errorResponse(error);
      }
      // Probe all nodes in parallel so total time is roughly the slowest
      // node rather than the sum of every connect timeout.
      const probes = await Promise.allSettled(
        nodes.map((node) =>
          execSSH("echo ok", node.name === "default" ? undefined : node.name, {
            timeoutMs: PROBE_TIMEOUT_MS,
          }),
        ),
      );
      const results = nodes.map((node, i) => {
        const probe = probes[i];
        if (probe.status === "fulfilled") return `${node.name} (${node.port === 22 ? node.host : `${node.host}:${node.port}`}) -- online`;
        const error = probe.reason;
        if (error instanceof DryRunError) {
          return `${node.name} (${node.port === 22 ? node.host : `${node.host}:${node.port}`}) -- not probed (dry run)`;
        }
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        return `${node.name} (${node.port === 22 ? node.host : `${node.host}:${node.port}`}) -- offline (${reason})`;
      });

      return {
        content: [{
          type: "text" as const,
          text: results.join("\n") || "No nodes configured.",
        }],
      };
    },
  );
}
