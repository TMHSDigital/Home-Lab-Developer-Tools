import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { register as npmCerts } from "../npmCerts.js";
import { register as adguardFilterToggle } from "../adguardFilterToggle.js";
import { register as sshTest } from "../sshTest.js";
import { register as piReboot } from "../piReboot.js";
import { register as backupStatus } from "../backupStatus.js";
import { register as serviceHealth } from "../serviceHealth.js";
import { register as healthCheck } from "../healthCheck.js";
import { register as nodeList } from "../nodeList.js";

/**
 * HOMELAB_DRY_RUN with the real execSSH: no tool may report success, a
 * parsed result or an authentication failure; each describes the command it
 * would have run.
 */
type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function handlerOf(register: (server: never) => void): Handler {
  let handler: Handler | null = null;
  register({
    registerTool: (_n: string, _c: unknown, h: Handler) => {
      handler = h;
    },
  } as never);
  if (!handler) throw new Error("handler not captured");
  return handler;
}

const ENV = ["HOMELAB_DRY_RUN", "HOMELAB_PI_HOST", "HOMELAB_NODES"];

beforeEach(() => {
  process.env.HOMELAB_DRY_RUN = "true";
  process.env.HOMELAB_PI_HOST = "raspberrypi.local";
  delete process.env.HOMELAB_NODES;
});

afterEach(() => {
  for (const k of ENV) delete process.env[k];
});

describe("dry-run mode", () => {
  it.each([
    ["npmCerts", npmCerts, {}, "/api/tokens"],
    ["adguardFilterToggle", adguardFilterToggle, { url: "https://l.example/a.txt", enabled: false, confirm: true }, "/control/filtering/status"],
    ["sshTest", sshTest, {}, "echo ok"],
    ["piReboot", piReboot, { confirm: true }, "docker ps"],
    ["backupStatus", backupStatus, {}, "snapshots"],
    ["serviceHealth", serviceHealth, {}, "docker ps -a"],
    ["healthCheck", healthCheck, {}, "docker"],
  ] as const)("%s returns the planned command instead of a result", async (_name, register, args, fragment) => {
    const result = await handlerOf(register)({ ...args });
    const text = result.content[0].text;
    expect(result.isError).toBeUndefined();
    expect(text).toMatch(/^\[dry-run\] would execute on raspberrypi\.local: /);
    expect(text).toContain(fragment);
    expect(text).toContain("Nothing was run (HOMELAB_DRY_RUN)");
    expect(text).not.toMatch(/: OK|Reboot command sent|Check authentication|non-JSON|\[FAIL\]/);
  });

  it("nodeList does not report nodes as online or offline", async () => {
    const text = (await handlerOf(nodeList)({})).content[0].text;
    expect(text).toBe("default (raspberrypi.local) -- not probed (dry run)");
  });

  it("node: \"all\" fan-out shows each node's plan and is not an error", async () => {
    process.env.HOMELAB_NODES = JSON.stringify({ nas: { host: "nas.local" } });
    const result = await handlerOf(serviceHealth)({ node: "all" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("2 of 2 nodes responded.");
    expect(result.content[0].text).toContain("=== nas (nas.local) ===\n[dry-run] would execute on nas.local: docker ps -a");
  });
});
