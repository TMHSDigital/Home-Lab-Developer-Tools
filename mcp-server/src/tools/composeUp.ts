import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const COMPOSE_DIR = process.env.HOMELAB_COMPOSE_DIR || "/opt/homelab/docker";

const inputSchema = {
  ...nodeParam,
  stacks: z
    .array(z.string())
    .optional()
    .describe("Specific compose files to start (e.g. ['compose.monitoring.yml']). Omit for all."),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_composeUp",
    "Start Docker Compose stacks on the Pi",
    inputSchema,
    async (args) => {
      try {
        let files = "-f compose.base.yml";
        if (args.stacks && args.stacks.length > 0) {
          files += " " + args.stacks.map((s) => `-f ${s}`).join(" ");
        } else {
          files += " -f compose.monitoring.yml -f compose.network.yml -f compose.apps.yml -f compose.security.yml -f compose.storage.yml -f compose.tools.yml";
        }

        const output = await execSSH(
          `cd ${COMPOSE_DIR} && docker compose ${files} up -d --remove-orphans 2>&1`,
          args.node,
        );

        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
