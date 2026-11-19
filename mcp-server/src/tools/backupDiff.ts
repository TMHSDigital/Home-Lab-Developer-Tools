import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { READ_ONLY } from "../utils/annotations.js";

const inputSchema = {
  ...nodeParam,
  snapshotA: z.string().min(1).describe("First snapshot ID (older)"),
  snapshotB: z.string().min(1).describe("Second snapshot ID (newer)"),
  limit: z
    .number()
    .int()
    .min(0)
    .max(5000)
    .optional()
    .default(100)
    .describe("Maximum changed paths to list before the statistics (default 100; 0 for statistics only)"),
};

/** restic diff lines that describe one changed path ("+    /path", "M    /path", ...). */
const CHANGE_LINE = /^[+\-MTU?]\s+\//;

/**
 * Keep the first `limit` changed-path lines and every other line (the
 * header and the statistics block), and note how many paths were omitted.
 */
export function limitDiff(output: string, limit: number): string {
  const kept: string[] = [];
  let changes = 0;
  for (const line of output.split("\n")) {
    if (CHANGE_LINE.test(line)) {
      changes++;
      if (changes > limit) continue;
    }
    kept.push(line);
  }
  const omitted = changes - Math.min(changes, limit);
  if (omitted > 0) {
    kept.push(`(${omitted} of ${changes} changed paths omitted; raise limit to see more)`);
  }
  return kept.join("\n");
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupDiff",
    {
      description:
        "Show the difference between two restic backup snapshots: the first `limit` changed paths plus restic's statistics",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        const output = await execSSH(
          resticCommand(`diff '${args.snapshotA}' '${args.snapshotB}' 2>&1`, args.node),
          args.node,
          { timeoutMs: TIMEOUTS.medium },
        );

        return { content: [{ type: "text" as const, text: limitDiff(output, args.limit ?? 100) }] };
      } catch (error) {
        return resticErrorResponse(error, backupRepo(args.node));
      }
    },
  );
}
