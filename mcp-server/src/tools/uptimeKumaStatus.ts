import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, setting, curlErrorResponse } from "../utils/service-http.js";
import { READ_ONLY } from "../utils/annotations.js";
import { completeJson } from "../utils/json-output.js";

const SERVICE = SERVICES.uptimeKuma;

/** Uptime Kuma status page slugs: lowercase letters, digits and dashes. */
export const SLUG_RE = /^[a-z0-9-]+$/;

/** Slug from the argument, then HOMELAB_UPTIME_KUMA_SLUG, then "default". */
export function resolveSlug(slug?: string, node?: string): string {
  return slug || setting(node, "HOMELAB_UPTIME_KUMA_SLUG", "default");
}

const inputSchema = {
  ...nodeParam,
  slug: z
    .string()
    .regex(SLUG_RE, "Slug may only contain lowercase letters, digits and '-'")
    .optional()
    .describe("Status page slug (default: HOMELAB_UPTIME_KUMA_SLUG or 'default')"),
  beats: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(1)
    .describe("Recent heartbeats to show per monitor as a status history (default 1: latest only)"),
};

const SPLIT = "@@HEARTBEATS@@";

const STATUS: Record<number, string> = { 0: "DOWN", 1: "UP", 2: "PENDING", 3: "MAINTENANCE" };

const heartbeatSchema = z.object({
  status: z.number(),
  time: z.string(),
  ping: z.number().nullish(),
  msg: z.string().nullish(),
});

const heartbeatBodySchema = z.object({
  heartbeatList: z.record(z.string(), z.array(heartbeatSchema)).default({}),
  uptimeList: z.record(z.string(), z.number()).default({}),
});

const pageSchema = z.object({
  publicGroupList: z
    .array(z.object({ monitorList: z.array(z.object({ id: z.number(), name: z.string() })).default([]) }))
    .default([]),
});

/**
 * One line per monitor (latest status, check time, ping, 24h uptime)
 * instead of the raw body, which holds about 100 heartbeats per monitor.
 */
export function summarizeHeartbeats(pageJson: string, heartbeatJson: string, beats: number): string {
  const names = new Map<string, string>();
  for (const group of pageSchema.parse(JSON.parse(pageJson)).publicGroupList) {
    for (const m of group.monitorList) names.set(String(m.id), m.name);
  }
  const body = heartbeatBodySchema.parse(JSON.parse(heartbeatJson));
  const ids = new Set([...names.keys(), ...Object.keys(body.heartbeatList)]);
  const counts: Record<string, number> = {};
  const lines = [...ids]
    .map((id) => {
      const list = [...(body.heartbeatList[id] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
      const latest = list[list.length - 1];
      const status = latest ? (STATUS[latest.status] ?? `status ${latest.status}`) : "NO DATA";
      counts[status] = (counts[status] ?? 0) + 1;
      const parts = [`${names.get(id) ?? "monitor"} (id ${id}): ${status}`];
      if (latest) {
        parts.push(`last check ${latest.time}`);
        if (latest.ping != null) parts.push(`ping ${latest.ping} ms`);
      }
      const uptime = body.uptimeList[`${id}_24`];
      if (uptime != null) parts.push(`24h uptime ${(uptime * 100).toFixed(1)}%`);
      if (latest?.status === 0 && latest.msg) parts.push(`message: ${latest.msg}`);
      if (beats > 1 && list.length > 0) {
        parts.push(`history (oldest first): ${list.slice(-beats).map((b) => (STATUS[b.status] ?? "?")[0]).join("")}`);
      }
      return { status, line: parts.join(", ") };
    })
    .sort((a, b) => Number(a.status === "UP") - Number(b.status === "UP"));
  if (lines.length === 0) return "No monitors on this status page.";
  const summary = Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(", ");
  return [`${lines.length} monitors: ${summary}.`, ...lines.map((l) => l.line)].join("\n");
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_uptimeKumaStatus",
    {
      description: "Get the status of all Uptime Kuma monitors",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      let port = SERVICE.defaultPort;
      let slug = "default";
      try {
        port = servicePort(SERVICE, args.node);
        slug = resolveSlug(args.slug, args.node);
        if (!SLUG_RE.test(slug)) {
          return errorResponse(
            new Error(
              `Invalid Uptime Kuma status page slug "${slug}" (HOMELAB_UPTIME_KUMA_SLUG). ` +
                "Use lowercase letters, digits and '-'.",
            ),
          );
        }
        const base = `http://localhost:${port}/api/status-page`;
        const output = completeJson(
          await execSSH(
            `curl -sf '${base}/${slug}' && printf '\\n%s\\n' '${SPLIT}' && curl -sf '${base}/heartbeat/${slug}'`,
            args.node,
          ),
        );
        const [page, heartbeats] = output.split(`\n${SPLIT}\n`);
        if (heartbeats === undefined) throw new SyntaxError("Unexpected response from Uptime Kuma");
        return { content: [{ type: "text" as const, text: summarizeHeartbeats(page, heartbeats, args.beats ?? 1) }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port, {
          httpError:
            `${SERVICE.name} returned an HTTP error for status page "${slug}". Check that the ` +
            "status page exists, or pass `slug` / set HOMELAB_UPTIME_KUMA_SLUG.",
        });
      }
    },
  );
}
