#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";

import { TOOLS } from "./tool-registry.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

// One version source: release.yml bumps package.json, which ships with the package.
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const server = new McpServer({
  name: "homelab-mcp",
  version,
});

for (const register of Object.values(TOOLS)) register(server);

registerResources(server);
registerPrompts(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
