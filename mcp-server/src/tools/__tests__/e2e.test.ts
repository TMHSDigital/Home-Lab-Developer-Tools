import { describe, it, expect } from "vitest";
import { execSSH } from "../../utils/ssh-api.js";

const SKIP = !process.env.HOMELAB_TEST_PI;

describe.skipIf(SKIP)("e2e tests (live Pi)", () => {
  it("SSH connectivity", async () => {
    const output = await execSSH("echo ok");
    expect(output).toBe("ok");
  });

  it("piStatus returns expected sections", async () => {
    const output = await execSSH([
      'echo "=== Uptime ==="',
      "uptime",
      'echo "=== CPU Temperature ==="',
      "cat /sys/class/thermal/thermal_zone0/temp | awk '{printf \"%.1f C\\n\", $1/1000}'",
      'echo "=== Memory ==="',
      "free -h | head -2",
      'echo "=== Disk ==="',
      "df -h / | tail -1",
    ].join(" && "));

    expect(output).toContain("Uptime");
    expect(output).toContain("CPU Temperature");
    expect(output).toContain("Memory");
    expect(output).toContain("Disk");
  });

  it("Docker containers are running", async () => {
    const output = await execSSH(
      "docker ps --format '{{.Names}}' | head -5",
    );
    expect(output.length).toBeGreaterThan(0);
  });

  it("disk usage is non-empty", async () => {
    const output = await execSSH("df -h / | tail -1");
    expect(output).toContain("/");
  });

  it("healthCheck commands succeed", async () => {
    const checks = [
      "echo ok",
      "docker --version",
      "docker compose version",
      "command -v curl",
    ];

    for (const cmd of checks) {
      const output = await execSSH(cmd);
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it("diagnostics commands return data", async () => {
    const output = await execSSH("uname -a && free -h | head -2 && df -h / | tail -1");
    expect(output).toContain("Linux");
  });
});
