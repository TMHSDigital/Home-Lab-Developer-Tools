import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Registers every tool module on a fake server and checks the result
 * against the source tree, the entry point and the docs.
 */
interface Registered {
  name: string;
  file: string;
  shape: z.ZodRawShape;
}

const modules = (import.meta as unknown as {
  glob: (pattern: string, opts: { eager: true }) => Record<string, { register?: (s: never) => void }>;
}).glob("../*.ts", { eager: true });

const registered: Registered[] = [];
for (const [path, mod] of Object.entries(modules)) {
  if (typeof mod.register !== "function") continue;
  const file = path.replace("../", "").replace(/\.ts$/, "");
  const fake = {
    tool: (name: string, _desc: string, shape: z.ZodRawShape) => {
      registered.push({ name, file, shape });
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

  it("registers every tool in index.ts", () => {
    const index = readFileSync(join(toolsDir, "../index.ts"), "utf8");
    for (const r of registered) {
      expect(index).toContain(`from "./tools/${r.file}.js"`);
    }
    const calls = (index.match(/^\s*register[A-Za-z0-9]+\(server\);/gm) ?? []).filter(
      (c) => !/register(Resources|Prompts)\(/.test(c),
    );
    expect(calls.length).toBe(registered.length);
  });

  it("is listed in the README, CLAUDE.md and mcp-tools.json", () => {
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    const claude = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
    const manifest = JSON.parse(readFileSync(join(repoRoot, "mcp-tools.json"), "utf8")) as Array<{ name: string }>;
    const manifestNames = manifest.map((t) => t.name).sort();
    expect(manifestNames).toEqual(registered.map((r) => r.name).sort());
    for (const r of registered) {
      expect(readme, `${r.name} missing from README.md`).toContain(`\`${r.name}\``);
      expect(claude, `${r.name} missing from CLAUDE.md`).toContain(`\`${r.name}\``);
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
        .map(([key, s]) => [key, (s as z.ZodType).safeParse("x").success ? "x" : true]),
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
