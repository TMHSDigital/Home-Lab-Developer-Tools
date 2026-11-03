import { describe, it, expect } from "vitest";
import { z } from "zod";
import { execSSH } from "../../utils/ssh-api.js";
import { register as piStatus } from "../piStatus.js";
import { register as diskUsage } from "../diskUsage.js";
import { register as serviceHealth } from "../serviceHealth.js";
import { register as healthCheck } from "../healthCheck.js";
import { register as diagnostics } from "../diagnostics.js";
import { register as kernelInfo } from "../kernelInfo.js";
import { register as sshTest } from "../sshTest.js";
import { register as networkInfo } from "../networkInfo.js";
import { register as systemdServices } from "../systemdServices.js";

const SKIP = !process.env.HOMELAB_TEST_PI;

type Result = { content: { text: string }[]; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

/**
 * Capture a tool's real handler and schema so e2e runs the shipped command
 * (with schema defaults applied, as the MCP server does), not a copy.
 */
function handlerOf(register: (server: never) => void): Handler {
  let handler: Handler | null = null;
  let shape: z.ZodRawShape = {};
  register({
    tool: (_n: string, _d: string, s: z.ZodRawShape, h: Handler) => {
      shape = s;
      handler = h;
    },
  } as never);
  if (!handler) throw new Error("handler not captured");
  const h = handler as Handler;
  return (args) => h(z.object(shape).parse(args));
}

async function run(register: (server: never) => void, args: Record<string, unknown> = {}): Promise<string> {
  const result = await handlerOf(register)(args);
  const text = result.content[0]?.text ?? "";
  expect(result.isError, text).toBeFalsy();
  expect(text.length).toBeGreaterThan(0);
  return text;
}

describe.skipIf(SKIP)("e2e tests (live Pi, read-only tools)", () => {
  it("SSH connectivity", async () => {
    expect(await execSSH("echo ok")).toBe("ok");
  });

  it("homelab_sshTest", async () => {
    expect(await run(sshTest)).toContain(": OK");
  });

  it("homelab_piStatus", async () => {
    await run(piStatus);
  });

  it("homelab_diskUsage", async () => {
    expect(await run(diskUsage, { path: "/", depth: 1 })).toContain("=== Filesystem ===");
  });

  it("homelab_serviceHealth", async () => {
    await run(serviceHealth);
  });

  it("homelab_healthCheck", async () => {
    const text = await run(healthCheck);
    expect(text).toContain("[PASS] SSH connectivity");
    expect(text).toMatch(/\d+\/\d+ checks passed/);
  });

  it("homelab_diagnostics", async () => {
    const text = await run(diagnostics);
    expect(text).toContain("=== Kernel ===");
    expect(text).toContain("Linux");
  });

  it("homelab_kernelInfo", async () => {
    await run(kernelInfo);
  });

  it("homelab_networkInfo", async () => {
    await run(networkInfo);
  });

  it("homelab_systemdServices", async () => {
    await run(systemdServices);
  });
});
