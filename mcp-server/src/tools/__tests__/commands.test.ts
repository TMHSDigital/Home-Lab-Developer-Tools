import { describe, it, expect } from "vitest";
import { buildAptHistoryCommand } from "../aptHistory.js";

describe("aptHistory command", () => {
  it("reads rotated archives oldest-first and the current log last before tail", () => {
    const cmd = buildAptHistoryCommand(25);
    const rotated = cmd.indexOf("ls -1v /var/log/apt/history.log.*.gz");
    const reversed = cmd.indexOf("| tac |");
    const current = cmd.indexOf("/var/log/apt/history.log 2>/dev/null");
    expect(rotated).toBeGreaterThanOrEqual(0);
    expect(reversed).toBeGreaterThan(rotated);
    expect(current).toBeGreaterThan(reversed);
    expect(cmd.trim().endsWith("| tail -n 25")).toBe(true);
    // -h drops the filename prefix zgrep adds when given several files
    expect(cmd).toContain("zgrep -hE");
  });
});
