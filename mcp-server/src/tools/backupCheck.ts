import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { backupRepo } from "../utils/config.js";
import { resticCommand, resticErrorResponse } from "../utils/restic.js";
import { READ_ONLY } from "../utils/annotations.js";

/** restic --read-data-subset forms: a percentage ("5%") or a part ("1/10"). */
export const READ_DATA_SUBSET_RE = /^(?:\d{1,2}(?:\.\d{1,2})?%|100%|[1-9]\d{0,3}\/[1-9]\d{0,3})$/;

const inputSchema = {
  ...nodeParam,
  readDataSubset: z
    .string()
    .regex(READ_DATA_SUBSET_RE, "Use a percentage such as 5% or a part such as 1/10")
    .optional()
    .describe(
      "Also read and verify this share of the pack data (e.g. '5%' or '1/10'). Omit to check only the repository structure",
    ),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_backupCheck",
    {
      description:
        "Verify restic repository integrity with `restic check`, optionally reading a subset of the data. Takes the repository lock, so it waits for or blocks a running backup",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      let repo = "";
      try {
        repo = backupRepo(args.node);
        const subset = args.readDataSubset ? ` --read-data-subset='${args.readDataSubset}'` : "";
        const output = await execSSH(resticCommand(`check${subset} 2>&1`, args.node), args.node, {
          timeoutMs: TIMEOUTS.long,
        });
        return { content: [{ type: "text" as const, text: output || "restic check finished with no output." }] };
      } catch (error) {
        return resticErrorResponse(error, repo);
      }
    },
  );
}
