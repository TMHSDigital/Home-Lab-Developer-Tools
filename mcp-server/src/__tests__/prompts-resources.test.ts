import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerResources, NODES_URI } from "../resources.js";
import { registerPrompts } from "../prompts.js";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let client: Client;
let server: McpServer;

beforeAll(async () => {
  server = new McpServer({ name: "test", version: "0.0.0" });
  registerResources(server);
  registerPrompts(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
  await server.close();
});

afterEach(() => {
  delete process.env.HOMELAB_NODES;
  delete process.env.HOMELAB_PI_HOST;
});

describe("resources", () => {
  it("lists the nodes resource", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain(NODES_URI);
  });

  it("returns node names and hosts only", async () => {
    process.env.HOMELAB_PI_HOST = "pi.example";
    process.env.HOMELAB_NODES = JSON.stringify({
      nas: { host: "nas.example", user: "admin", keyPath: "~/.ssh/k", env: { HOMELAB_NPM_PASSWORD: "x" } },
    });
    const result = await client.readResource({ uri: NODES_URI });
    const text = String((result.contents[0] as { text: string }).text);
    expect(JSON.parse(text)).toEqual({
      nodes: [
        { name: "default", host: "pi.example" },
        { name: "nas", host: "nas.example" },
      ],
    });
    expect(text).not.toContain("admin");
    expect(text).not.toContain("keyPath");
    expect(text).not.toContain("HOMELAB_NPM_PASSWORD");
  });

  it("reports an invalid registry instead of failing", async () => {
    process.env.HOMELAB_NODES = "{bad";
    const result = await client.readResource({ uri: NODES_URI });
    expect(String((result.contents[0] as { text: string }).text)).toContain("HOMELAB_NODES is not valid JSON");
  });
});

describe("prompts", () => {
  it("lists the workflow prompts", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      "investigate-container",
      "morning-health-check",
      "pre-reboot-checklist",
    ]);
  });

  it("morning-health-check is read-only and honors node", async () => {
    const result = await client.getPrompt({ name: "morning-health-check", arguments: { node: "nas" } });
    const text = String((result.messages[0].content as { text: string }).text);
    expect(text).toContain("homelab_piStatus");
    expect(text).toContain('node: "nas"');
    expect(text).toContain("do not restart");
  });

  it("pre-reboot-checklist never reboots on its own", async () => {
    const result = await client.getPrompt({ name: "pre-reboot-checklist", arguments: {} });
    const text = String((result.messages[0].content as { text: string }).text);
    expect(text).toContain("Do not call `homelab_piReboot`");
  });

  it("investigate-container targets the given service", async () => {
    const result = await client.getPrompt({ name: "investigate-container", arguments: { service: "grafana" } });
    const text = String((result.messages[0].content as { text: string }).text);
    expect(text).toContain('service: "grafana"');
    expect(text).toContain("homelab_serviceLogs");
  });

  it("only references tool names that exist", async () => {
    const toolsDir = join(dirname(fileURLToPath(import.meta.url)), "../tools");
    const known = new Set(
      readdirSync(toolsDir).filter((f) => f.endsWith(".ts")).map((f) => `homelab_${f.slice(0, -3)}`),
    );
    const { prompts } = await client.listPrompts();
    for (const p of prompts) {
      const args: Record<string, string> = p.name === "investigate-container" ? { service: "x" } : {};
      const result = await client.getPrompt({ name: p.name, arguments: args });
      const text = String((result.messages[0].content as { text: string }).text);
      const referenced = [...text.matchAll(/`(homelab_[A-Za-z0-9]+)`/g)].map((m) => m[1]);
      expect(referenced.length).toBeGreaterThan(0);
      for (const tool of referenced) expect(known.has(tool), tool).toBe(true);
    }
  });
});
