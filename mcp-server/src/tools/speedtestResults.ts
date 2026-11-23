import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";
import { completeJson } from "../utils/json-output.js";
import { SERVICES, servicePort, setting, shellQuote, curlErrorResponse } from "../utils/service-http.js";
import { READ_ONLY } from "../utils/annotations.js";

const SERVICE = SERVICES.speedtest;
const resultPage = z.object({ data: z.array(z.unknown()) });

const inputSchema = {
  ...nodeParam,
  count: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(5)
    .describe("Maximum number of recent speedtest results to return, newest first"),
};

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_speedtestResults",
    {
      description: "Get recent speedtest results from Speedtest Tracker (requires HOMELAB_SPEEDTEST_TOKEN with results:read)",
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => {
      let port = SERVICE.defaultPort;
      let token: string | undefined;
      try {
        port = servicePort(SERVICE, args.node);
        token = setting(args.node, "HOMELAB_SPEEDTEST_TOKEN");
        if (!token) {
          throw new Error("Set HOMELAB_SPEEDTEST_TOKEN to a Speedtest Tracker API token with the results:read permission.");
        }
        const output = completeJson(await execSSH(
          `curl -sf -H ${shellQuote(`Authorization: Bearer ${token}`)} -H 'Accept: application/json' ` +
            `'http://localhost:${port}/api/v1/results?page%5Bsize%5D=${args.count}&sort=-created_at'`,
          args.node,
        ));

        let page: unknown;
        try {
          page = JSON.parse(output);
        } catch {
          page = null;
        }
        if (!resultPage.safeParse(page).success) {
          throw new Error("Unexpected Speedtest Tracker results response: expected JSON with a data array.");
        }

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        const result = curlErrorResponse(error, SERVICE, port);
        if (token) {
          // SSH errors and dry runs include the command; keep this credential out of tool output.
          const quotedToken = shellQuote(token).slice(1, -1);
          for (const item of result.content) {
            item.text = item.text.replaceAll(quotedToken, "****").replaceAll(token, "****");
          }
        }
        return result;
      }
    },
  );
}
