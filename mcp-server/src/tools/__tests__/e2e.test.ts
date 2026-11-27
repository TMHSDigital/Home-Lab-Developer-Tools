import { describe, it, expect } from "vitest";
import { runTool as run } from "./helpers/real-tool.js";
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

const SKIP = process.env.HOMELAB_TEST_PI !== "true";

describe.skipIf(SKIP)("e2e tests (live Pi, read-only tools)", { timeout: 60_000 }, () => {
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
    expect(await run(diskUsage, { path: "/var/log", depth: 1 })).toContain("=== Filesystem ===");
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
