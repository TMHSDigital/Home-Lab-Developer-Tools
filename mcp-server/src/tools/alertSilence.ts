import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { SERVICES, servicePort, curlErrorResponse } from "../utils/service-http.js";
import { shellQuote } from "./adguardFilterToggle.js";
import { destructive } from "../utils/annotations.js";

const SERVICE = SERVICES.alertmanager;

/** Prometheus label names. */
export const LABEL_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Duration like 30m, 2h or 1d. */
export const DURATION_RE = /^([1-9][0-9]{0,3})([mhd])$/;
/** Alertmanager silence IDs are UUIDs. */
export const SILENCE_ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

const matcherSchema = z.object({
  name: z.string().regex(LABEL_NAME_RE, "Label names use letters, digits and underscores"),
  value: z.string().min(1).max(1024),
  isRegex: z.boolean().optional().default(false).describe("Treat value as a regular expression"),
  isEqual: z.boolean().optional().default(true).describe("false negates the matcher (!= or !~)"),
});

const inputSchema = {
  ...nodeParam,
  action: z.enum(["create", "expire"]).describe("create a new silence or expire an existing one"),
  matchers: z
    .array(matcherSchema)
    .min(1)
    .max(20)
    .optional()
    .describe("create: label matchers, e.g. [{name: 'alertname', value: 'HighCPU'}] or [{name: 'instance', value: 'pi:9100'}]"),
  duration: z
    .string()
    .regex(DURATION_RE, "Use a duration like 30m, 2h or 1d")
    .optional()
    .default("2h")
    .describe("create: how long the silence lasts from now (30m, 2h, 1d; max 30d). Default 2h"),
  comment: z.string().min(1).max(500).optional().describe("create: why the alerts are silenced (required by Alertmanager)"),
  createdBy: z.string().min(1).max(100).optional().default("homelab-mcp").describe("create: author shown in Alertmanager"),
  id: z.string().regex(SILENCE_ID_RE, "Silence IDs are UUIDs").optional().describe("expire: silence ID from homelab_alertSilences"),
  ...confirmParam,
};

type Args = {
  node?: string;
  action: "create" | "expire";
  matchers?: z.infer<typeof matcherSchema>[];
  duration?: string;
  comment?: string;
  createdBy?: string;
  id?: string;
};

export function durationMs(duration: string): number {
  const m = DURATION_RE.exec(duration);
  if (!m) throw new Error(`Invalid duration "${duration}". Use a duration like 30m, 2h or 1d.`);
  const ms = Number(m[1]) * UNIT_MS[m[2] as keyof typeof UNIT_MS];
  if (ms > MAX_DURATION_MS) throw new Error("Silences can last at most 30d.");
  return ms;
}

/** Request body for POST /api/v2/silences. */
export function buildSilenceBody(args: Args, now: Date): string {
  if (!args.matchers || args.matchers.length === 0) throw new Error("action=create needs at least one matcher.");
  if (!args.comment) throw new Error("action=create needs a comment explaining the silence.");
  const endsAt = new Date(now.getTime() + durationMs(args.duration ?? "2h"));
  return JSON.stringify({
    matchers: args.matchers.map((m) => ({
      name: m.name,
      value: m.value,
      isRegex: m.isRegex ?? false,
      isEqual: m.isEqual ?? true,
    })),
    startsAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    createdBy: args.createdBy ?? "homelab-mcp",
    comment: args.comment,
  });
}

export function silenceCommand(args: Args, now: Date): string {
  const base = `http://localhost:${servicePort(SERVICE, args.node)}/api/v2`;
  if (args.action === "expire") {
    if (!args.id) throw new Error("action=expire needs the silence id (see homelab_alertSilences).");
    return `curl -sf -X DELETE '${base}/silence/${args.id}'`;
  }
  return (
    `curl -sf -X POST -H 'Content-Type: application/json' ` +
    `-d ${shellQuote(buildSilenceBody(args, now))} '${base}/silences'`
  );
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_alertSilence",
    {
      description: "Create an Alertmanager silence for matching alerts, or expire one by ID (requires confirm=true)",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled(args.action === "expire" ? "Silence expiry" : "Silence", {
          node: args.node,
          commands: () => [silenceCommand(args, new Date())],
        });
      }

      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const output = await execSSH(silenceCommand(args, new Date()), args.node);
        if (output.startsWith("[dry-run]")) {
          return { content: [{ type: "text" as const, text: output }] };
        }
        if (args.action === "expire") {
          return { content: [{ type: "text" as const, text: `Silence ${args.id} expired.` }] };
        }
        const id = (JSON.parse(output) as { silenceID?: string }).silenceID;
        return {
          content: [{
            type: "text" as const,
            text: `Silence ${id ?? "(unknown id)"} created for ${args.duration ?? "2h"}. Expire it early with action=expire.`,
          }],
        };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port, {
          httpError:
            args.action === "expire"
              ? `${SERVICE.name} rejected the request. Check that silence ${args.id} exists and is not already expired.`
              : `${SERVICE.name} rejected the silence. Check the matchers and that the comment is set.`,
        });
      }
    },
  );
}
