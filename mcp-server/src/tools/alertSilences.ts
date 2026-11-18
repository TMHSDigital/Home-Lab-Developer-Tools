import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";
import { completeJson } from "../utils/json-output.js";
import { READ_ONLY } from "../utils/annotations.js";

const SERVICE = SERVICES.alertmanager;

const inputSchema = {
  ...nodeParam,
  state: z
    .enum(["active", "pending", "expired"])
    .optional()
    .describe("Only silences in this state. Returns all states if omitted"),
};

const silenceSchema = z.object({
  id: z.string(),
  status: z.object({ state: z.string() }),
  matchers: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      isRegex: z.boolean().optional(),
      isEqual: z.boolean().optional(),
    }),
  ),
  startsAt: z.string(),
  endsAt: z.string(),
  createdBy: z.string().optional(),
  comment: z.string().optional(),
});

type Matcher = z.infer<typeof silenceSchema>["matchers"][number];

function formatMatcher(m: Matcher): string {
  const op = m.isEqual === false ? (m.isRegex ? "!~" : "!=") : m.isRegex ? "=~" : "=";
  return `${m.name}${op}"${m.value}"`;
}

/** One line per silence, active first, then pending, then expired. */
export function summarizeSilences(json: string, state?: string): string {
  const order: Record<string, number> = { active: 0, pending: 1, expired: 2 };
  const silences = z
    .array(silenceSchema)
    .parse(JSON.parse(json) ?? [])
    .filter((s) => !state || s.status.state === state)
    .sort((a, b) => (order[a.status.state] ?? 3) - (order[b.status.state] ?? 3) || b.endsAt.localeCompare(a.endsAt));
  if (silences.length === 0) return state ? `No ${state} silences.` : "No silences.";
  return silences
    .map((s) =>
      `${s.id} [${s.status.state}] {${s.matchers.map(formatMatcher).join(", ")}} ` +
      `${s.startsAt} -> ${s.endsAt} by ${s.createdBy || "unknown"}: ${s.comment || ""}`.trimEnd(),
    )
    .join("\n");
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_alertSilences",
    {
      description: "List Alertmanager silences (matchers, time window, author, comment), optionally filtered by state",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const output = await execSSH(`curl -sf 'http://localhost:${port}/api/v2/silences'`, args.node);
        if (output.startsWith("[dry-run]")) {
          return { content: [{ type: "text" as const, text: output }] };
        }
        return { content: [{ type: "text" as const, text: summarizeSilences(completeJson(output), args.state) }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
