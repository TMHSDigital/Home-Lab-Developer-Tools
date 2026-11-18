import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { completeJson } from "../utils/json-output.js";

const inputSchema = {
  ...nodeParam,
  path: z.string().optional().describe("Filter snapshots containing this path"),
  tag: z.string().optional().describe("Filter snapshots by tag"),
  host: z.string().optional().describe("Filter snapshots by hostname"),
  count: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(20)
    .describe("Maximum number of snapshots to return, newest first (default 20, max 200)"),
};

const snapshotSchema = z.object({
  short_id: z.string().optional(),
  id: z.string().optional(),
  time: z.string(),
  hostname: z.string().optional(),
  paths: z.array(z.string()).optional(),
  tags: z.array(z.string()).nullish(),
});

/** Newest `count` snapshots as one compact JSON object per line. */
export function summarizeSnapshots(json: string, count: number): string {
  const snapshots = z.array(snapshotSchema).parse(JSON.parse(json) ?? []);
  const newest = [...snapshots].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, count);
  const lines = newest.map((s) =>
    JSON.stringify({
      id: s.short_id ?? s.id?.slice(0, 8),
      time: s.time,
      host: s.hostname,
      paths: s.paths ?? [],
      tags: s.tags ?? [],
    }),
  );
  const header =
    snapshots.length > newest.length
      ? `Showing the newest ${newest.length} of ${snapshots.length} snapshots. Raise count or add filters to see more.`
      : `${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"}, newest first.`;
  return [header, ...lines].join("\n");
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupList",
    "List restic backup snapshots (newest first, compact) with optional filtering by path, tag, or host",
    inputSchema,
    async (args) => {
      let repo = "";
      try {
        repo = backupRepo(args.node);
        const flags: string[] = [];
        if (args.path) flags.push(`--path '${args.path}'`);
        if (args.tag) flags.push(`--tag '${args.tag}'`);
        if (args.host) flags.push(`--host '${args.host}'`);
        const extra = flags.length > 0 ? " " + flags.join(" ") : "";
        const output = await execSSH(
          resticCommand(`snapshots${extra} --json`, args.node),
          args.node,
        );
        if (output.startsWith("[dry-run]")) {
          return { content: [{ type: "text" as const, text: output }] };
        }

        const text = summarizeSnapshots(completeJson(output), args.count ?? 20);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return resticErrorResponse(error, repo);
      }
    },
  );
}
