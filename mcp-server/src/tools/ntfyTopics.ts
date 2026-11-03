import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { SERVICES, servicePort, setting, curlErrorResponse } from "../utils/service-http.js";

const SERVICE = SERVICES.ntfy;

/** Ntfy topic names: [-_A-Za-z0-9]{1,64}; several can be joined with commas. */
export const TOPIC_LIST_RE = /^[-_A-Za-z0-9]{1,64}(,[-_A-Za-z0-9]{1,64})*$/;

/** Resolve the topic list from the argument or HOMELAB_NTFY_TOPICS. */
export function resolveTopics(topic?: string, node?: string): string | null {
  const candidate = (topic ?? setting(node, "HOMELAB_NTFY_TOPICS") ?? "").replace(/\s+/g, "");
  if (!candidate) return null;
  return TOPIC_LIST_RE.test(candidate) ? candidate : null;
}

const inputSchema = {
  ...nodeParam,
  topic: z
    .string()
    .regex(TOPIC_LIST_RE, "Topic names may only contain letters, digits, '-' and '_' (comma-separate several)")
    .optional()
    .describe(
      "Topic, or comma-separated topics (e.g. 'alerts,backups'). Defaults to HOMELAB_NTFY_TOPICS. " +
        "Ntfy has no 'all topics' subscription, so at least one topic is required",
    ),
  since: z
    .string()
    .optional()
    .default("1h")
    .describe("Time window for recent messages (e.g. '1h', '30m', '1d')"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_ntfyTopics",
    "List Ntfy topics and recent messages",
    inputSchema,
    async (args) => {
      let port = SERVICE.defaultPort;
      let topicPath: string | null = null;
      try {
        port = servicePort(SERVICE, args.node);
        topicPath = resolveTopics(args.topic, args.node);
        if (!topicPath) {
          return errorResponse(
            new Error(
              "No ntfy topic given. Pass `topic` (one topic or a comma-separated list such as " +
                "'alerts,backups') or set HOMELAB_NTFY_TOPICS. Ntfy has no wildcard subscription for all topics.",
            ),
          );
        }
        const cmd = `curl -sf 'http://localhost:${port}/${topicPath}/json?since=${args.since}&poll=1'`;
        const output = await execSSH(cmd, args.node);
        return { content: [{ type: "text" as const, text: output || "No recent messages found." }] };
      } catch (error) {
        return curlErrorResponse(error, SERVICE, port, {
          httpError:
            `${SERVICE.name} returned an HTTP error for topic(s) "${topicPath}". Check the topic ` +
            `names, the 'since' value (e.g. 1h, 30m, all), and access control on the server.`,
        });
      }
    },
  );
}
