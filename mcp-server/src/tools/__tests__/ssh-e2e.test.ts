import { describe, it, expect } from "vitest";
import { execSSH, errorResponse } from "../../utils/ssh-api.js";
import { CommandFailedError } from "../../utils/errors.js";
import { register as sshTest } from "../sshTest.js";
import { register as kernelInfo } from "../kernelInfo.js";
import { register as networkInfo } from "../networkInfo.js";
import { register as diskUsage } from "../diskUsage.js";
import { register as healthCheck } from "../healthCheck.js";
import { runTool } from "./helpers/real-tool.js";

describe.skipIf(process.env.HOMELAB_TEST_SSH !== "true")("e2e tests (OpenSSH fixture)", { timeout: 60_000 }, () => {
  it("authenticates with a private key and runs a command", async () => {
    expect(await execSSH("echo ok")).toBe("ok");
  });

  it("reports SSH connectivity, hostname and uptime", async () => {
    const text = await runTool(sshTest);
    expect(text).toContain(": OK");
    expect(text).toContain("Hostname:");
    expect(text).not.toContain("unknown");
  });

  it("reads Linux kernel information", async () => {
    const text = await runTool(kernelInfo);
    expect(text).toContain("=== Kernel ===");
    expect(text).toContain("Linux");
    expect(text).toContain("=== Boot Parameters ===");
    expect(text).not.toContain("failed with exit status");
  });

  it("reads real network interfaces and DNS settings", async () => {
    const text = await runTool(networkInfo);
    expect(text).toContain("lo 127.0.0.1/8");
    expect(text).toContain("nameserver");
    expect(text).toContain("Tailscale not installed");
    expect(text).not.toContain("failed with exit status");
  });

  it("measures the small fixture directory under /tmp", async () => {
    const text = await runTool(diskUsage, { path: "/tmp", depth: 1 });
    expect(text).toContain("=== Filesystem ===");
    expect(text).toContain("=== Directory Usage (/tmp, depth 1) ===");
    expect(text).toContain("/tmp/homelab-e2e");
    expect(text).toContain("Docker not installed");
  });

  it("reports available and missing utilities without treating either as an SSH failure", async () => {
    const text = await runTool(healthCheck);
    expect(text).toContain("[PASS] SSH connectivity");
    expect(text).toContain("[PASS] curl:");
    expect(text).toContain("[FAIL] Docker:");
    expect(text).toMatch(/\d+\/7 checks passed/);
  });

  it.each([
    ["printf 'stderr diagnostic\\n' >&2; exit 23", "stderr diagnostic"],
    ["sh -c 'echo merged diagnostic >&2; exit 23' 2>&1", "merged diagnostic"],
  ])("preserves exit status and diagnostics for %s", async (command, diagnostic) => {
    const error = await execSSH(command).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error).toMatchObject({ exitCode: 23, command, message: diagnostic });
    const result = errorResponse(error);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(diagnostic);
  });
});
