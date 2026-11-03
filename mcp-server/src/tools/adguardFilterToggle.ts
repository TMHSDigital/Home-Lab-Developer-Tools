import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled } from "../utils/confirm-param.js";
import { SERVICES, servicePort, adguardAuth, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.adguard;

const inputSchema = {
  ...nodeParam,
  url: z
    .string()
    .min(1)
    .max(2048)
    .describe("URL (or path) of an existing filter list, exactly as shown by homelab_adguardFilters"),
  enabled: z.boolean().describe("true to enable the filter list, false to disable it"),
  ...confirmParam,
};

interface AdguardFilter {
  url: string;
  name: string;
  enabled: boolean;
}

interface FilteringStatus {
  filters?: AdguardFilter[] | null;
  whitelist_filters?: AdguardFilter[] | null;
}

/** Wrap a value in single quotes for the remote shell. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Find a filter (blocklist or allowlist) by its exact URL. */
export function findFilter(
  status: FilteringStatus,
  url: string,
): { filter: AdguardFilter; whitelist: boolean } | null {
  const block = (status.filters ?? []).find((f) => f.url === url);
  if (block) return { filter: block, whitelist: false };
  const allow = (status.whitelist_filters ?? []).find((f) => f.url === url);
  if (allow) return { filter: allow, whitelist: true };
  return null;
}

/** Request body for AdGuard Home's POST /control/filtering/set_url. */
export function buildSetUrlPayload(filter: AdguardFilter, whitelist: boolean, enabled: boolean): string {
  return JSON.stringify({
    url: filter.url,
    whitelist,
    data: { name: filter.name, url: filter.url, enabled },
  });
}

export function register(server: McpServer): void {
  server.tool(
    "homelab_adguardFilterToggle",
    "Enable or disable an existing AdGuard Home filter list by URL (requires confirm=true)",
    inputSchema,
    async (args) => {
      if (!args.confirm) {
        return confirmCancelled("Filter toggle");
      }

      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        const auth = adguardAuth(args.node);
        const base = `http://localhost:${port}/control/filtering`;

        const statusOutput = await execSSH(`curl -sf ${auth} '${base}/status'`, args.node);
        const status = JSON.parse(statusOutput) as FilteringStatus;
        const match = findFilter(status, args.url);
        if (!match) {
          return errorResponse(
            new Error(
              `No AdGuard filter list with URL "${args.url}". ` +
                "Use homelab_adguardFilters to list the configured URLs.",
            ),
          );
        }

        const { filter, whitelist } = match;
        const state = args.enabled ? "enabled" : "disabled";
        if (filter.enabled === args.enabled) {
          return {
            content: [{ type: "text" as const, text: `Filter "${filter.name}" (${filter.url}) is already ${state}.` }],
          };
        }

        const payload = buildSetUrlPayload(filter, whitelist, args.enabled);
        await execSSH(
          `curl -sf ${auth} -X POST -H 'Content-Type: application/json' ` +
            `-d ${shellQuote(payload)} '${base}/set_url'`,
          args.node,
        );

        return {
          content: [{
            type: "text" as const,
            text: `Filter "${filter.name}" (${filter.url}) ${state}.` +
              (whitelist ? " (allowlist)" : ""),
          }],
        };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port);
      }
    },
  );
}
