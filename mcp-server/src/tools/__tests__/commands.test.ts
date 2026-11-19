import { toJournalSince, toNtfySince } from "../../utils/since-param.js";
import { describe, it, expect, afterEach } from "vitest";
import { buildAptHistoryCommand } from "../aptHistory.js";
import { STATE_FILTERS } from "../alertList.js";
import { resolveTopics, TOPIC_LIST_RE } from "../ntfyTopics.js";
import { resolveSlug, SLUG_RE } from "../uptimeKumaStatus.js";
import { buildComposeCommand, buildStackCommand, KNOWN_STACK_FILES } from "../../utils/compose.js";
import { assertCommandSafe } from "../../utils/ssh-api.js";
import { SINCE_RE, toDockerSince } from "../../utils/since-param.js";

describe("since parameter", () => {
  it.each(["30s", "10m", "24h", "7d", "2024-05-01", "2024-05-01T12:00", "2024-05-01T12:00:00Z", "2024-05-01T12:00:00+02:00"])(
    "accepts %s",
    (v) => expect(SINCE_RE.test(v)).toBe(true),
  );

  it.each(["", "1w", "yesterday", "10 m", "2024/05/01", "1.5h"])("rejects %j", (v) =>
    expect(SINCE_RE.test(v)).toBe(false),
  );

  it("converts days to hours for docker logs", () => {
    expect(toDockerSince("7d")).toBe("168h");
    expect(toDockerSince("90m")).toBe("90m");
    expect(toDockerSince("2024-05-01")).toBe("2024-05-01");
  });
});

describe("compose file selection", () => {
  const saved = {
    dir: process.env.HOMELAB_COMPOSE_DIR,
    files: process.env.HOMELAB_COMPOSE_FILES,
  };
  afterEach(() => {
    if (saved.dir === undefined) delete process.env.HOMELAB_COMPOSE_DIR;
    else process.env.HOMELAB_COMPOSE_DIR = saved.dir;
    if (saved.files === undefined) delete process.env.HOMELAB_COMPOSE_FILES;
    else process.env.HOMELAB_COMPOSE_FILES = saved.files;
  });

  it("uses HOMELAB_COMPOSE_FILES in order when set", () => {
    process.env.HOMELAB_COMPOSE_DIR = "/srv/stack";
    process.env.HOMELAB_COMPOSE_FILES = "docker-compose.yml, override.yml";
    expect(buildComposeCommand("ps")).toBe(
      "cd /srv/stack || exit 1; docker compose -f docker-compose.yml -f override.yml ps",
    );
  });

  it("rejects unexpected characters in HOMELAB_COMPOSE_FILES", () => {
    process.env.HOMELAB_COMPOSE_FILES = "a.yml;b.yml";
    expect(() => buildComposeCommand("ps")).toThrow(/Invalid entry/);
  });

  it("discovers files on the node, keeping the reference order first", () => {
    delete process.env.HOMELAB_COMPOSE_FILES;
    const cmd = buildComposeCommand("up -d");
    expect(cmd).toContain(`for f in ${KNOWN_STACK_FILES.join(" ")}; do`);
    expect(cmd).toContain("for f in compose.*.yml;");
    expect(cmd).toContain("docker-compose.yml");
    expect(cmd).toContain("No compose files found");
    expect(cmd.endsWith("docker compose $files up -d")).toBe(true);
    expect(() => assertCommandSafe(cmd)).not.toThrow();
  });
});

describe("stack subset commands", () => {
  afterEach(() => {
    delete process.env.HOMELAB_COMPOSE_DIR;
    delete process.env.HOMELAB_COMPOSE_FILES;
  });

  it("keeps the full project file list and targets only the stack's services", () => {
    const cmd = buildStackCommand(["up -d $services"], ["compose.monitoring.yml"]);
    expect(cmd).toContain(`for f in ${KNOWN_STACK_FILES.join(" ")}; do`);
    expect(cmd).toContain(
      "services=$(docker compose -f compose.base.yml -f compose.monitoring.yml config --services)",
    );
    expect(cmd).toContain('grep -vxF "$base"');
    expect(cmd).toContain('if [ -z "$services" ]');
    expect(cmd.endsWith("docker compose $files up -d $services")).toBe(true);
    expect(cmd).not.toContain("--remove-orphans");
    expect(() => assertCommandSafe(cmd)).not.toThrow();
  });

  it("includes base services when compose.base.yml is requested", () => {
    const cmd = buildStackCommand(["up -d $services"], ["compose.base.yml"]);
    expect(cmd).toContain("services=$(docker compose -f compose.base.yml config --services)");
    expect(cmd).not.toContain("grep -vxF");
  });

  it("uses HOMELAB_COMPOSE_FILES as the project file list", () => {
    process.env.HOMELAB_COMPOSE_FILES = "compose.base.yml,compose.apps.yml";
    const cmd = buildStackCommand(["stop $services", "rm -f $services"], ["compose.apps.yml"]);
    expect(cmd).toContain('files=" -f compose.base.yml -f compose.apps.yml"');
    expect(cmd).toContain("docker compose $files stop $services && docker compose $files rm -f $services");
  });

  it("rejects stack names with unexpected characters", () => {
    expect(() => buildStackCommand(["up -d $services"], ["a.yml;b"])).toThrow(/Invalid stack file/);
  });
});

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

describe("since conversions", () => {
  it("turns durations into journalctl relative times and ISO dates into journalctl dates", () => {
    expect(toJournalSince("30m")).toBe("-30m");
    expect(toJournalSince("7d")).toBe("-7d");
    expect(toJournalSince("2026-11-18")).toBe("2026-11-18");
    expect(toJournalSince("2026-11-18T10:00:00Z")).toBe("2026-11-18 10:00:00 UTC");
  });

  it("passes durations to ntfy and turns dates into Unix seconds", () => {
    expect(toNtfySince("1h")).toBe("1h");
    expect(toNtfySince("2026-11-18")).toBe(String(Date.UTC(2026, 10, 18) / 1000));
    expect(toNtfySince("2026-11-18T10:00:00Z")).toBe(String(Date.UTC(2026, 10, 18, 10) / 1000));
  });
});
