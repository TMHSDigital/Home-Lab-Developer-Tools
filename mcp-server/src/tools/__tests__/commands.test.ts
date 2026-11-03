import { describe, it, expect, afterEach } from "vitest";
import { buildAptHistoryCommand } from "../aptHistory.js";
import { STATE_FILTERS } from "../alertList.js";
import { resolveTopics, TOPIC_LIST_RE } from "../ntfyTopics.js";
import { resolveSlug, SLUG_RE } from "../uptimeKumaStatus.js";

describe("uptimeKumaStatus slug", () => {
  const saved = process.env.HOMELAB_UPTIME_KUMA_SLUG;
  afterEach(() => {
    if (saved === undefined) delete process.env.HOMELAB_UPTIME_KUMA_SLUG;
    else process.env.HOMELAB_UPTIME_KUMA_SLUG = saved;
  });

  it("prefers the argument, then the env var, then 'default'", () => {
    delete process.env.HOMELAB_UPTIME_KUMA_SLUG;
    expect(resolveSlug()).toBe("default");
    process.env.HOMELAB_UPTIME_KUMA_SLUG = "homelab";
    expect(resolveSlug()).toBe("homelab");
    expect(resolveSlug("ops-page")).toBe("ops-page");
  });

  it("only accepts lowercase letters, digits and dashes", () => {
    expect(SLUG_RE.test("my-page-2")).toBe(true);
    expect(SLUG_RE.test("My Page")).toBe(false);
    expect(SLUG_RE.test("a/b")).toBe(false);
  });
});

describe("ntfyTopics topic resolution", () => {
  const saved = process.env.HOMELAB_NTFY_TOPICS;
  afterEach(() => {
    if (saved === undefined) delete process.env.HOMELAB_NTFY_TOPICS;
    else process.env.HOMELAB_NTFY_TOPICS = saved;
  });

  it("requires a topic: no wildcard default", () => {
    delete process.env.HOMELAB_NTFY_TOPICS;
    expect(resolveTopics(undefined)).toBeNull();
    expect(resolveTopics("")).toBeNull();
  });

  it("accepts single and comma-separated topics", () => {
    expect(resolveTopics("alerts")).toBe("alerts");
    expect(resolveTopics("alerts,backups")).toBe("alerts,backups");
  });

  it("falls back to HOMELAB_NTFY_TOPICS", () => {
    process.env.HOMELAB_NTFY_TOPICS = "alerts, homelab_ops";
    expect(resolveTopics(undefined)).toBe("alerts,homelab_ops");
  });

  it("rejects names outside ntfy's topic charset", () => {
    expect(TOPIC_LIST_RE.test("*")).toBe(false);
    expect(TOPIC_LIST_RE.test("a/b")).toBe(false);
    process.env.HOMELAB_NTFY_TOPICS = "bad topic!";
    expect(resolveTopics(undefined)).toBeNull();
  });
});

describe("alertList state filters", () => {
  it("maps each state to Alertmanager v2 boolean flags, not a state param", () => {
    expect(STATE_FILTERS.active).toBe("active=true&silenced=false&inhibited=false&unprocessed=false");
    expect(STATE_FILTERS.suppressed).toContain("silenced=true");
    expect(STATE_FILTERS.suppressed).toContain("inhibited=true");
    expect(STATE_FILTERS.suppressed).toContain("active=false");
    expect(STATE_FILTERS.unprocessed).toContain("unprocessed=true");
    for (const q of Object.values(STATE_FILTERS)) expect(q).not.toContain("state=");
  });
});

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
