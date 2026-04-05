import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  path: z.string().optional().describe("Filter snapshots containing this path"),
  tag: z.string().optional().describe("Filter snapshots by tag"),
  host: z.string().optional().describe("Filter snapshots by hostname"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_backupList",
    "List all restic backup snapshots with optional filtering by path, tag, or host",
    inputSchema,
    async (args) => {
      try {
        const repo = process.env.HOMELAB_BACKUP_REPO || "/mnt/backup/restic";
        const flags: string[] = [];
        if (args.path) flags.push(`--path '${args.path}'`);
        if (args.tag) flags.push(`--tag '${args.tag}'`);
        if (args.host) flags.push(`--host '${args.host}'`);
        const extra = flags.length > 0 ? " " + flags.join(" ") : "";
        const output = await execSSH(
          `sudo restic -r ${repo} snapshots${extra} --json 2>/dev/null || echo "No backup repo found at ${repo} or restic not configured"`,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
