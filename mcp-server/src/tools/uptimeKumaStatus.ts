import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, setting, curlErrorResponse } from "../utils/service-http.js";

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
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_uptimeKumaStatus",
    "Get the status of all Uptime Kuma monitors",
    inputSchema,
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
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/status-page/heartbeat/${slug}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
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
