import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { completeJson } from "../utils/json-output.js";
import { READ_ONLY } from "../utils/annotations.js";
import { summarizeSnapshots } from "./backupList.js";

const inputSchema = {
  ...nodeParam,
  count: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(5)
    .describe("Number of recent snapshots to show"),
  maxAgeHours: z
    .number()
    .positive()
    .max(24 * 365)
    .optional()
    .default(26)
    .describe("Report STALE when the newest snapshot is older than this many hours (default 26)"),
};

const timesSchema = z.array(z.object({ time: z.string() }).passthrough());

function formatAge(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * One-line verdict on the newest snapshot: "OK: ..." when it is younger than
 * `maxAgeHours`, otherwise "STALE: ...". Computed here so callers do not have
 * to do date math on restic's output.
 */
export function backupVerdict(json: string, maxAgeHours: number, now: Date = new Date()): string {
  const snapshots = timesSchema.parse(JSON.parse(json) ?? []);
  const times = snapshots.map((s) => Date.parse(s.time)).filter((t) => Number.isFinite(t));
  if (times.length === 0) return "STALE: no snapshots found in the repository.";
  const newest = Math.max(...times);
  const age = now.getTime() - newest;
  const label = `latest snapshot ${formatAge(age)} old (${new Date(newest).toISOString()}, limit ${maxAgeHours}h)`;
  return age > maxAgeHours * 3_600_000 ? `STALE: ${label}` : `OK: ${label}`;
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupStatus",
    {
      description:
        "Check the latest restic backup snapshots on the Pi. The first line is an OK/STALE verdict on the newest snapshot's age",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      let repo = "";
      try {
        repo = backupRepo(args.node);
        const output = await execSSH(
          resticCommand(`snapshots --latest ${args.count} --json`, args.node),
          args.node,
        );

        const json = completeJson(output);
        const text = [
          backupVerdict(json, args.maxAgeHours ?? 26),
          summarizeSnapshots(json, args.count ?? 5),
        ].join("\n");
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return resticErrorResponse(error, repo);
      }
    },
  );
}
