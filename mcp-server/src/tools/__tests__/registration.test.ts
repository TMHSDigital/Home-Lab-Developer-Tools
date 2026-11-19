import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { TOOLS } from "../../tool-registry.js";

/**
 * Registers every tool module on a fake server and checks the result
 * against the source tree, the entry point and the docs.
 */
interface Registered {
  name: string;
  file: string;
  shape: z.ZodRawShape;
  annotations?: Record<string, unknown>;
}

/** Tools that change state without being confirm-gated (no data is removed). */
const CHANGES_STATE = ["homelab_composePull", "homelab_ntfySend"];

const modules = (import.meta as unknown as {
  glob: (pattern: string, opts: { eager: true }) => Record<string, { register?: (s: never) => void }>;
}).glob("../*.ts", { eager: true });

const registered: Registered[] = [];
for (const [path, mod] of Object.entries(modules)) {
  if (typeof mod.register !== "function") continue;
  const file = path.replace("../", "").replace(/\.ts$/, "");
  const fake = {
    registerTool: (
      name: string,
      config: { description: string; inputSchema: z.ZodRawShape; annotations?: Record<string, unknown> },
    ) => {
      registered.push({ name, file, shape: config.inputSchema, annotations: config.annotations });
    },
  };
  mod.register(fake as never);
}

const here = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(here, "..");
const repoRoot = join(here, "../../../..");

const GATED_REQUIRED = [
  "homelab_piReboot",
  "homelab_backupRun",
  "homelab_backupRestore",
  "homelab_volumeBackup",
  "homelab_certRenew",
  "homelab_nodeExec",
  "homelab_serviceRestart",
  "homelab_composeUp",
  "homelab_composeDown",
  "homelab_adguardFilterToggle",
  "homelab_alertSilence",
  "homelab_systemdControl",
];

describe("tool registration", () => {
  it("registers exactly one tool per file in src/tools", () => {
    const files = readdirSync(toolsDir).filter((f) => f.endsWith(".ts")).map((f) => f.slice(0, -3)).sort();
    expect(registered.map((r) => r.file).sort()).toEqual(files);
  });

  it("uses unique homelab_camelCase names matching the file name", () => {
    const names = registered.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    for (const r of registered) {
      expect(r.name).toMatch(/^homelab_[a-z][A-Za-z0-9]+$/);
      expect(r.name).toBe(`homelab_${r.file}`);
    }
  });

  it("lists every tool in the registry that index.ts registers", () => {
    expect(Object.keys(TOOLS).sort()).toEqual(registered.map((r) => r.file).sort());
    for (const r of registered) {
      expect(TOOLS[r.file], r.file).toBe(modules[`../${r.file}.ts`].register);
    }
    const index = readFileSync(join(toolsDir, "../index.ts"), "utf8");
    expect(index).toContain("for (const register of Object.values(TOOLS)) register(server);");
  });

  it("is listed in the README, CLAUDE.md and mcp-tools.json", () => {
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    const claude = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
    const manifest = JSON.parse(readFileSync(join(repoRoot, "mcp-tools.json"), "utf8")) as Array<{ name: string }>;
    const manifestNames = manifest.map((t) => t.name).sort();
    expect(manifestNames).toEqual(registered.map((r) => r.name).sort());
    const serverReadme = readFileSync(join(repoRoot, "mcp-server/README.md"), "utf8");
    for (const r of registered) {
      expect(readme, `${r.name} missing from README.md`).toContain(`\`${r.name}\``);
      expect(claude, `${r.name} missing from CLAUDE.md`).toContain(`\`${r.name}\``);
      expect(serverReadme, `${r.name} missing from mcp-server/README.md`).toContain(`\`${r.name}\``);
    }
  });

  it("states the current tool count everywhere it is published", () => {
    const n = registered.length;
    const read = (p: string) => readFileSync(join(repoRoot, p), "utf8");
    const plugin = JSON.parse(read(".cursor-plugin/plugin.json")) as { description: string };
    const pkg = JSON.parse(read("mcp-server/package.json")) as { description: string };
    expect(plugin.description).toContain(`${n} MCP tools`);
    expect(pkg.description).toContain(`${n} tools`);
    expect(read("README.md")).toContain(`11 rules &nbsp;&bull;&nbsp; ${n} MCP tools`);
    expect(read("README.md")).toContain(`badge/tools-${n}-`);
    expect(read("CLAUDE.md")).toContain(`## MCP Tools (${n})`);
    expect(read("mcp-server/README.md")).toContain(`provides ${n} tools`);
  });

  it("states the right subtotal for each README tool category", () => {
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8").replace(/\r\n/g, "\n");
    const categories = [...readme.matchAll(/\*\*([^*\n]+)\*\* \((\d+)\)\n\n\| Tool \| What It Does \|\n\|---\|---\|\n((?:\|.*\n)+)/g)];
    expect(categories.length).toBeGreaterThan(0);
    let total = 0;
    for (const [, name, count, rows] of categories) {
      const listed = rows.trim().split("\n").length;
      total += listed;
      expect(listed, `README category ${name}`).toBe(Number(count));
    }
    expect(total).toBe(registered.length);
  });
});

describe("tool annotations", () => {
  const gated = [...GATED_REQUIRED, "homelab_aptUpdate"];

  it.each(registered.map((r) => [r.name, r] as const))("%s declares annotations", (name, r) => {
    const a = r.annotations;
    expect(a, `${name} has no annotations`).toBeDefined();
    if (gated.includes(name)) {
      expect(a).toMatchObject({ readOnlyHint: false, destructiveHint: true });
      expect(typeof a!.idempotentHint).toBe("boolean");
    } else if (CHANGES_STATE.includes(name)) {
      expect(a).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    } else {
      expect(a).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });

  it("registers no tool through the deprecated server.tool() overload", () => {
    for (const r of registered) {
      const source = readFileSync(join(toolsDir, `${r.file}.ts`), "utf8");
      expect(source, r.file).not.toContain("server.tool(");
    }
  });
});

describe("tool input schemas", () => {
  it.each(GATED_REQUIRED)("%s requires a boolean confirm", (name) => {
    const tool = registered.find((r) => r.name === name);
    expect(tool, name).toBeDefined();
    const schema = z.object(tool!.shape);
    const base = Object.fromEntries(
      Object.entries(tool!.shape)
        .filter(([key, s]) => key !== "confirm" && !(s as z.ZodType).safeParse(undefined).success)
        .map(([key, s]) => {
          const options = (s as { options?: unknown[] }).options;
          if (Array.isArray(options)) return [key, options[0]];
          return [key, (s as z.ZodType).safeParse("x").success ? "x" : true];
        }),
    );
    expect(schema.safeParse(base).success).toBe(false);
    expect(schema.safeParse({ ...base, confirm: "yes" }).success).toBe(false);
    expect(schema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("aptUpdate accepts an optional boolean confirm", () => {
    const tool = registered.find((r) => r.name === "homelab_aptUpdate")!;
    const schema = z.object(tool.shape);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ upgrade: true, confirm: true }).success).toBe(true);
    expect(schema.safeParse({ confirm: "yes" }).success).toBe(false);
  });

  it('offers node: "all" exactly on the read-only fan-out tools', () => {
    const FAN_OUT = [
      "homelab_aptUpgradable",
      "homelab_backupStatus",
      "homelab_certList",
      "homelab_diskUsage",
      "homelab_healthCheck",
      "homelab_kernelInfo",
      "homelab_nodeStatus",
      "homelab_piStatus",
      "homelab_serviceHealth",
      "homelab_ufwStatus",
    ];
    const offersAll = registered
      .filter((r) => /"all"/.test((r.shape.node as z.ZodType | undefined)?.description ?? ""))
      .map((r) => r.name)
      .sort();
    expect(offersAll).toEqual(FAN_OUT);
    for (const r of registered.filter((t) => FAN_OUT.includes(t.name))) {
      const source = readFileSync(join(toolsDir, `${r.file}.ts`), "utf8");
      expect(source, r.file).toMatch(/\b(fanOut|forNodes)\(/);
      expect(r.annotations, r.name).toMatchObject({ readOnlyHint: true });
    }
  });

  it("every tool accepts an optional node, except the node-specific tools", () => {
    const NODE_REQUIRED = ["homelab_nodeExec", "homelab_nodeStatus"];
    for (const r of registered) {
      if (r.name === "homelab_nodeList") {
        expect(r.shape.node).toBeUndefined();
        continue;
      }
      expect(r.shape.node, r.name).toBeDefined();
      if (NODE_REQUIRED.includes(r.name)) {
        expect((r.shape.node as z.ZodType).safeParse(undefined).success, r.name).toBe(false);
        continue;
      }
      expect((r.shape.node as z.ZodType).safeParse(undefined).success, r.name).toBe(true);
    }
  });
});
