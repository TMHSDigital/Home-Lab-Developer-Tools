import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { CommandFailedError } from "../utils/errors.js";
import { nodeParam } from "../utils/node-param.js";

const DEFAULT_PORT = 3001;
const SERVICE_NAME = "Uptime Kuma";

/** Uptime Kuma status page slugs: lowercase letters, digits and dashes. */
export const SLUG_RE = /^[a-z0-9-]+$/;

/** Slug from the argument, then HOMELAB_UPTIME_KUMA_SLUG, then "default". */
export function resolveSlug(slug?: string): string {
  return slug || process.env.HOMELAB_UPTIME_KUMA_SLUG || "default";
}

const inputSchema = {
  ...nodeParam,
  slug: z
    .string()
    .regex(SLUG_RE, "Slug may only contain lowercase letters, digits and '-'")
    .optional()
    .describe("Status page slug (default: HOMELAB_UPTIME_KUMA_SLUG or 'default')"),
};

function getPort(): number {
  const override = process.env.HOMELAB_UPTIME_KUMA_PORT;
  return override ? parseInt(override, 10) : DEFAULT_PORT;
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_uptimeKumaStatus",
    "Get the status of all Uptime Kuma monitors",
    inputSchema,
    async (args) => {
      const port = getPort();
      const slug = resolveSlug(args.slug);
      if (!SLUG_RE.test(slug)) {
        return errorResponse(
          new Error(
            `Invalid Uptime Kuma status page slug "${slug}" (HOMELAB_UPTIME_KUMA_SLUG). ` +
              "Use lowercase letters, digits and '-'.",
          ),
        );
      }
      try {
        const output = await execSSH(
          `curl -sf 'http://localhost:${port}/api/status-page/heartbeat/${slug}'`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        if (error instanceof CommandFailedError) {
          if (error.exitCode === 7) {
            return errorResponse(
              new Error(
                `Could not connect to ${SERVICE_NAME} on port ${port}. Is it running? ` +
                  `Set HOMELAB_UPTIME_KUMA_PORT if using a non-default port.`,
              ),
            );
          }
          if (error.exitCode === 22) {
            return errorResponse(
              new Error(
                `${SERVICE_NAME} returned an HTTP error for status page "${slug}". Check that the ` +
                  "status page exists, or pass `slug` / set HOMELAB_UPTIME_KUMA_SLUG.",
              ),
            );
          }
        }
        return errorResponse(error);
      }
    },
  );
}
