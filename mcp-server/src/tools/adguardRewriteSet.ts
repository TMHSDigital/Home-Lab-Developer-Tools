import { isIP } from "node:net";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { confirmParam, confirmCancelled, maskCredentials } from "../utils/confirm-param.js";
import { SERVICES, servicePort, adguardAuth, shellQuote, curlErrorResponse } from "../utils/service-http.js";
import { destructive } from "../utils/annotations.js";

const SERVICE = SERVICES.adguard;

/** ASCII hostnames, including single-label local names and a trailing root dot. */
function isHostname(value: string): boolean {
  const name = value.endsWith(".") ? value.slice(0, -1) : value;
  return name.length > 0 && name.length <= 253 && name.split(".").every(
    (label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
  );
}

const inputSchema = {
  ...nodeParam,
  action: z.enum(["add", "delete"]).describe("Add a rewrite or delete the exact domain/answer pair"),
  domain: z.string().max(254).refine(
    (value) => isHostname(value.startsWith("*.") ? value.slice(2) : value),
    "Use an ASCII hostname, optionally prefixed with *.",
  ).describe("Domain to rewrite, optionally with a leading wildcard (for example *.home.lab)"),
  answer: z.string().max(254).refine(
    (value) => (!value.includes("%") && isIP(value) !== 0) ||
      (!/^[0-9.]+$/.test(value) && isHostname(value)),
    "Use an IPv4 address, IPv6 address, or ASCII hostname",
  ).describe("IPv4/IPv6 address or CNAME hostname; deletion requires the answer shown by homelab_adguardRewrites"),
  ...confirmParam,
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_adguardRewriteSet",
    {
      description: "Add or delete an AdGuard Home local DNS rewrite (requires confirm=true)",
      inputSchema,
      annotations: destructive(false),
    },
    async (args) => {
      const command = () =>
        `curl -sf ${adguardAuth(args.node)} -X POST -H 'Content-Type: application/json' ` +
        `-d ${shellQuote(JSON.stringify({ domain: args.domain, answer: args.answer }))} ` +
        `'http://localhost:${servicePort(SERVICE, args.node)}/control/rewrite/${args.action}'`;
      if (!args.confirm) {
        return confirmCancelled("DNS rewrite", { node: args.node, commands: () => [command()] });
      }
      let port = SERVICE.defaultPort;
      try {
        port = servicePort(SERVICE, args.node);
        await execSSH(command(), args.node);
        return {
          content: [{ type: "text" as const, text: `DNS rewrite ${args.domain} -> ${args.answer} ${args.action === "add" ? "added" : "deleted"}.` }],
        };
      } catch (error) {
        const result = curlErrorResponse(error, SERVICE, port);
        for (const item of result.content) item.text = maskCredentials(item.text);
        return result;
      }
    },
  );
}
