import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { sectionScript, CPU_TEMP_COMMAND } from "../section-script.js";
import { NETWORK_SECTIONS } from "../../tools/networkInfo.js";
import { assertCommandSafe } from "../ssh-api.js";

/** Run a script with POSIX sh; null when no sh is available (skips the test). */
function runSh(script: string): { stdout: string; status: number | null } | null {
  const r = spawnSync("sh", ["-c", script], { encoding: "utf8" });
  if (r.error) return null;
  return { stdout: r.stdout, status: r.status };
}

const hasSh = runSh("true") !== null;

describe("sectionScript", () => {
  it("keeps running after a failing section and reports its exit status", () => {
    const script = sectionScript([
      ["A", "echo a"],
      ["B", "echo partial; echo oops >&2; exit 3"],
      ["C", "echo c"],
    ]);
    expect(() => assertCommandSafe(script)).not.toThrow();
    const r = runSh(script);
    if (!r) return;
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(
      "=== A ===\na\n\n=== B ===\npartial\noops\n(failed with exit status 3)\n\n=== C ===\nc\n\n",
    );
  });

  it("quotes labels so a path in a label cannot break the script", () => {
    const r = runSh(sectionScript([["Usage (/it's here)", "echo ok"]]));
    if (!r) return;
    expect(r.stdout).toBe("=== Usage (/it's here) ===\nok\n\n");
  });

  it.skipIf(!hasSh)("networkInfo still reports DNS and Tailscale when the route probe fails", () => {
    const stubs = [
      "ip() { if [ \"$1\" = -4 ]; then echo '    inet 192.168.1.2/24 brd x scope global eth0'; " +
        "else echo 'RTNETLINK answers: error' >&2; return 2; fi; }",
      "tailscale() { echo 'Logged out.'; return 1; }",
    ].join("; ");
    const r = runSh(`${stubs}; ${sectionScript(NETWORK_SECTIONS)}`)!;
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("=== Default Gateway ===\nRTNETLINK answers: error\nNo default route\n");
    expect(r.stdout).toContain("=== DNS ===");
    expect(r.stdout).toContain("=== Tailscale ===\nLogged out.\n(failed with exit status 1)\n");
    expect(r.stdout).not.toContain("not installed");
  });

  it.skipIf(!hasSh)("diskUsage-style sections continue past df failing on a stale mount", () => {
    const stubs = [
      "df() { echo 'Filesystem Size Used Avail Use% Mounted on'; echo '/dev/root 29G 9G 19G 32% /'; " +
        "echo 'df: /mnt/nas: Stale file handle' >&2; return 1; }",
      "docker() { echo 'TYPE TOTAL'; }",
    ].join("; ");
    const script = sectionScript([
      ["Filesystem", "df -h"],
      ["Docker Disk Usage", "if command -v docker >/dev/null 2>&1; then docker system df; else echo 'Docker not installed'; fi"],
    ]);
    const r = runSh(`${stubs}; ${script}`)!;
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("/dev/root 29G 9G 19G 32% /\ndf: /mnt/nas: Stale file handle\n(failed with exit status 1)");
    expect(r.stdout).toContain("=== Docker Disk Usage ===\nTYPE TOTAL\n");
  });

  it.skipIf(!hasSh)("reports N/A for the CPU temperature on nodes without a thermal zone", () => {
    const r = runSh(CPU_TEMP_COMMAND.replace(/\/sys\/class\/thermal\/thermal_zone0\/temp/g, "/nonexistent/temp"))!;
    expect(r.stdout).toBe("N/A\n");
  });
});
