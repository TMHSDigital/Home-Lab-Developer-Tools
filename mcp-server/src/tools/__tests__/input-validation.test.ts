import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("input validation schemas", () => {
  describe("serviceLogs", () => {
    const schema = z.object({
      service: z.string().min(1),
      lines: z.number().int().positive().optional().default(50),
    });

    it("rejects empty service name", () => {
      expect(() => schema.parse({ service: "" })).toThrow();
    });

    it("accepts valid service name", () => {
      const result = schema.parse({ service: "grafana" });
      expect(result.service).toBe("grafana");
      expect(result.lines).toBe(50);
    });

    it("accepts custom line count", () => {
      const result = schema.parse({ service: "prometheus", lines: 100 });
      expect(result.lines).toBe(100);
    });

    it("rejects negative line count", () => {
      expect(() => schema.parse({ service: "test", lines: -1 })).toThrow();
    });
  });

  describe("serviceRestart", () => {
    const schema = z.object({
      service: z.string().min(1),
    });

    it("rejects empty service name", () => {
      expect(() => schema.parse({ service: "" })).toThrow();
    });

    it("accepts valid service name", () => {
      const result = schema.parse({ service: "nginx-proxy-manager" });
      expect(result.service).toBe("nginx-proxy-manager");
    });
  });

  describe("piReboot", () => {
    const schema = z.object({
      confirm: z.boolean(),
    });

    it("rejects missing confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("rejects non-boolean confirm", () => {
      expect(() => schema.parse({ confirm: "yes" })).toThrow();
    });

    it("accepts boolean confirm", () => {
      const result = schema.parse({ confirm: true });
      expect(result.confirm).toBe(true);
    });
  });

  describe("diskUsage", () => {
    const schema = z.object({
      path: z.string().optional().default("/"),
      depth: z.number().int().positive().optional().default(1),
    });

    it("uses defaults when no args provided", () => {
      const result = schema.parse({});
      expect(result.path).toBe("/");
      expect(result.depth).toBe(1);
    });

    it("accepts custom path and depth", () => {
      const result = schema.parse({ path: "/opt", depth: 2 });
      expect(result.path).toBe("/opt");
      expect(result.depth).toBe(2);
    });

    it("rejects zero depth", () => {
      expect(() => schema.parse({ depth: 0 })).toThrow();
    });
  });

  describe("backupRun", () => {
    const schema = z.object({
      confirm: z.boolean(),
    });

    it("rejects missing confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts confirm=false", () => {
      const result = schema.parse({ confirm: false });
      expect(result.confirm).toBe(false);
    });
  });

  describe("aptUpdate", () => {
    const schema = z.object({
      upgrade: z.boolean().optional().default(false),
    });

    it("defaults upgrade to false", () => {
      const result = schema.parse({});
      expect(result.upgrade).toBe(false);
    });

    it("accepts upgrade=true", () => {
      const result = schema.parse({ upgrade: true });
      expect(result.upgrade).toBe(true);
    });
  });

  describe("backupStatus", () => {
    const schema = z.object({
      count: z.number().int().positive().optional().default(5),
    });

    it("defaults count to 5", () => {
      const result = schema.parse({});
      expect(result.count).toBe(5);
    });

    it("accepts custom count", () => {
      const result = schema.parse({ count: 10 });
      expect(result.count).toBe(10);
    });

    it("rejects zero count", () => {
      expect(() => schema.parse({ count: 0 })).toThrow();
    });
  });

  describe("composeUp", () => {
    const schema = z.object({
      stacks: z.array(z.string()).optional(),
    });

    it("accepts empty stacks for all", () => {
      const result = schema.parse({});
      expect(result.stacks).toBeUndefined();
    });

    it("accepts specific stacks", () => {
      const result = schema.parse({ stacks: ["compose.monitoring.yml"] });
      expect(result.stacks).toEqual(["compose.monitoring.yml"]);
    });
  });

  describe("prometheusQuery", () => {
    const schema = z.object({
      query: z.string().min(1),
      time: z.string().optional(),
    });

    it("rejects empty query", () => {
      expect(() => schema.parse({ query: "" })).toThrow();
    });

    it("accepts valid PromQL", () => {
      const result = schema.parse({ query: "up{job='node'}" });
      expect(result.query).toBe("up{job='node'}");
      expect(result.time).toBeUndefined();
    });

    it("accepts query with time", () => {
      const result = schema.parse({ query: "up", time: "2026-01-01T00:00:00Z" });
      expect(result.time).toBe("2026-01-01T00:00:00Z");
    });
  });

  describe("grafanaSnapshot", () => {
    const schema = z.object({
      dashboard: z.string().min(1),
    });

    it("rejects empty dashboard UID", () => {
      expect(() => schema.parse({ dashboard: "" })).toThrow();
    });

    it("accepts valid dashboard UID", () => {
      const result = schema.parse({ dashboard: "abc123" });
      expect(result.dashboard).toBe("abc123");
    });
  });

  describe("alertList", () => {
    const schema = z.object({
      state: z.enum(["active", "suppressed", "unprocessed"]).optional(),
    });

    it("accepts no state filter", () => {
      const result = schema.parse({});
      expect(result.state).toBeUndefined();
    });

    it("accepts valid state", () => {
      const result = schema.parse({ state: "active" });
      expect(result.state).toBe("active");
    });

    it("rejects invalid state", () => {
      expect(() => schema.parse({ state: "firing" })).toThrow();
    });
  });

  describe("speedtestResults", () => {
    const schema = z.object({
      count: z.number().int().positive().optional().default(5),
    });

    it("defaults count to 5", () => {
      const result = schema.parse({});
      expect(result.count).toBe(5);
    });

    it("accepts custom count", () => {
      const result = schema.parse({ count: 10 });
      expect(result.count).toBe(10);
    });

    it("rejects zero count", () => {
      expect(() => schema.parse({ count: 0 })).toThrow();
    });

    it("rejects negative count", () => {
      expect(() => schema.parse({ count: -3 })).toThrow();
    });
  });

  describe("adguardQueryLog", () => {
    const schema = z.object({
      search: z.string().optional(),
      count: z.number().int().positive().optional().default(25),
    });

    it("defaults count to 25", () => {
      const result = schema.parse({});
      expect(result.count).toBe(25);
      expect(result.search).toBeUndefined();
    });

    it("accepts search filter", () => {
      const result = schema.parse({ search: "google.com" });
      expect(result.search).toBe("google.com");
    });

    it("accepts custom count", () => {
      const result = schema.parse({ count: 50 });
      expect(result.count).toBe(50);
    });

    it("rejects zero count", () => {
      expect(() => schema.parse({ count: 0 })).toThrow();
    });
  });

  describe("adguardStats (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("adguardFilters (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("npmProxyHosts (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("npmCerts (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("backupList", () => {
    const schema = z.object({
      path: z.string().optional(),
      tag: z.string().optional(),
      host: z.string().optional(),
    });

    it("accepts no filters", () => {
      const result = schema.parse({});
      expect(result.path).toBeUndefined();
      expect(result.tag).toBeUndefined();
      expect(result.host).toBeUndefined();
    });

    it("accepts path filter", () => {
      const result = schema.parse({ path: "/opt/homelab" });
      expect(result.path).toBe("/opt/homelab");
    });

    it("accepts tag filter", () => {
      const result = schema.parse({ tag: "docker-volume" });
      expect(result.tag).toBe("docker-volume");
    });

    it("accepts host filter", () => {
      const result = schema.parse({ host: "raspberrypi" });
      expect(result.host).toBe("raspberrypi");
    });

    it("accepts all filters combined", () => {
      const result = schema.parse({
        path: "/opt",
        tag: "daily",
        host: "pi5",
      });
      expect(result.path).toBe("/opt");
      expect(result.tag).toBe("daily");
      expect(result.host).toBe("pi5");
    });
  });

  describe("backupRestore", () => {
    const schema = z.object({
      snapshot: z.string().min(1),
      target: z.string().min(1),
      include: z.string().optional(),
      confirm: z.boolean(),
    });

    it("rejects empty snapshot", () => {
      expect(() =>
        schema.parse({ snapshot: "", target: "/tmp/restore", confirm: true }),
      ).toThrow();
    });

    it("rejects empty target", () => {
      expect(() =>
        schema.parse({ snapshot: "abc123", target: "", confirm: true }),
      ).toThrow();
    });

    it("rejects missing confirm", () => {
      expect(() =>
        schema.parse({ snapshot: "abc123", target: "/tmp/restore" }),
      ).toThrow();
    });

    it("rejects non-boolean confirm", () => {
      expect(() =>
        schema.parse({
          snapshot: "abc123",
          target: "/tmp/restore",
          confirm: "yes",
        }),
      ).toThrow();
    });

    it("accepts valid restore request", () => {
      const result = schema.parse({
        snapshot: "latest",
        target: "/tmp/restore",
        confirm: true,
      });
      expect(result.snapshot).toBe("latest");
      expect(result.target).toBe("/tmp/restore");
      expect(result.confirm).toBe(true);
    });

    it("accepts include pattern", () => {
      const result = schema.parse({
        snapshot: "abc123",
        target: "/tmp/restore",
        include: "/opt/homelab/docker/",
        confirm: true,
      });
      expect(result.include).toBe("/opt/homelab/docker/");
    });
  });

  describe("backupDiff", () => {
    const schema = z.object({
      snapshotA: z.string().min(1),
      snapshotB: z.string().min(1),
    });

    it("rejects empty snapshotA", () => {
      expect(() =>
        schema.parse({ snapshotA: "", snapshotB: "def456" }),
      ).toThrow();
    });

    it("rejects empty snapshotB", () => {
      expect(() =>
        schema.parse({ snapshotA: "abc123", snapshotB: "" }),
      ).toThrow();
    });

    it("accepts valid snapshot pair", () => {
      const result = schema.parse({
        snapshotA: "abc123",
        snapshotB: "def456",
      });
      expect(result.snapshotA).toBe("abc123");
      expect(result.snapshotB).toBe("def456");
    });
  });

  describe("volumeBackup", () => {
    const schema = z.object({
      volume: z.string().min(1),
      confirm: z.boolean(),
    });

    it("rejects empty volume name", () => {
      expect(() =>
        schema.parse({ volume: "", confirm: true }),
      ).toThrow();
    });

    it("rejects missing confirm", () => {
      expect(() => schema.parse({ volume: "grafana_data" })).toThrow();
    });

    it("rejects non-boolean confirm", () => {
      expect(() =>
        schema.parse({ volume: "grafana_data", confirm: "yes" }),
      ).toThrow();
    });

    it("accepts valid volume backup request", () => {
      const result = schema.parse({ volume: "grafana_data", confirm: true });
      expect(result.volume).toBe("grafana_data");
      expect(result.confirm).toBe(true);
    });

    it("accepts confirm=false", () => {
      const result = schema.parse({ volume: "grafana_data", confirm: false });
      expect(result.confirm).toBe(false);
    });
  });

  describe("ufwStatus (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("fail2banStatus", () => {
    const schema = z.object({
      jail: z.string().optional(),
    });

    it("accepts no jail filter", () => {
      const result = schema.parse({});
      expect(result.jail).toBeUndefined();
    });

    it("accepts specific jail", () => {
      const result = schema.parse({ jail: "sshd" });
      expect(result.jail).toBe("sshd");
    });
  });

  describe("openPorts (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("containerScan", () => {
    const schema = z.object({
      image: z.string().optional(),
    });

    it("accepts no image (scan all)", () => {
      const result = schema.parse({});
      expect(result.image).toBeUndefined();
    });

    it("accepts specific image", () => {
      const result = schema.parse({ image: "grafana/grafana:latest" });
      expect(result.image).toBe("grafana/grafana:latest");
    });
  });

  describe("journalLogs", () => {
    const schema = z.object({
      unit: z.string().optional(),
      priority: z.number().int().min(0).max(7).optional(),
      since: z.string().optional(),
      lines: z.number().int().positive().optional().default(50),
    });

    it("accepts empty input with defaults", () => {
      const result = schema.parse({});
      expect(result.lines).toBe(50);
      expect(result.unit).toBeUndefined();
    });

    it("accepts all filters", () => {
      const result = schema.parse({ unit: "docker.service", priority: 3, since: "1 hour ago", lines: 200 });
      expect(result.unit).toBe("docker.service");
      expect(result.priority).toBe(3);
      expect(result.since).toBe("1 hour ago");
      expect(result.lines).toBe(200);
    });

    it("rejects priority out of range", () => {
      expect(() => schema.parse({ priority: 8 })).toThrow();
      expect(() => schema.parse({ priority: -1 })).toThrow();
    });
  });

  describe("logSearch", () => {
    const schema = z.object({
      pattern: z.string().min(1),
      service: z.string().optional(),
      lines: z.number().int().positive().optional().default(100),
    });

    it("requires pattern", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts pattern only", () => {
      const result = schema.parse({ pattern: "error" });
      expect(result.pattern).toBe("error");
      expect(result.lines).toBe(100);
    });

    it("accepts all options", () => {
      const result = schema.parse({ pattern: "OOM", service: "grafana", lines: 50 });
      expect(result.service).toBe("grafana");
      expect(result.lines).toBe(50);
    });

    it("rejects empty pattern", () => {
      expect(() => schema.parse({ pattern: "" })).toThrow();
    });
  });

  describe("ntfySend", () => {
    const schema = z.object({
      topic: z.string().min(1),
      message: z.string().min(1),
      title: z.string().optional(),
      priority: z.enum(["min", "low", "default", "high", "urgent"]).optional(),
      tags: z.string().optional(),
    });

    it("requires topic and message", () => {
      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ topic: "alerts" })).toThrow();
    });

    it("accepts minimum inputs", () => {
      const result = schema.parse({ topic: "alerts", message: "Server rebooted" });
      expect(result.topic).toBe("alerts");
      expect(result.message).toBe("Server rebooted");
    });

    it("accepts all options", () => {
      const result = schema.parse({
        topic: "alerts",
        message: "Disk full",
        title: "Warning",
        priority: "high",
        tags: "warning,disk",
      });
      expect(result.title).toBe("Warning");
      expect(result.priority).toBe("high");
      expect(result.tags).toBe("warning,disk");
    });

    it("rejects invalid priority", () => {
      expect(() => schema.parse({ topic: "t", message: "m", priority: "critical" })).toThrow();
    });
  });

  describe("ntfyTopics", () => {
    const schema = z.object({
      topic: z.string().optional(),
      since: z.string().optional().default("1h"),
    });

    it("accepts empty input with defaults", () => {
      const result = schema.parse({});
      expect(result.since).toBe("1h");
      expect(result.topic).toBeUndefined();
    });

    it("accepts specific topic", () => {
      const result = schema.parse({ topic: "alerts", since: "30m" });
      expect(result.topic).toBe("alerts");
      expect(result.since).toBe("30m");
    });
  });

  describe("aptUpgradable (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("aptHistory", () => {
    const schema = z.object({
      lines: z.number().int().positive().optional().default(50),
    });

    it("accepts empty input with default", () => {
      const result = schema.parse({});
      expect(result.lines).toBe(50);
    });

    it("accepts custom line count", () => {
      const result = schema.parse({ lines: 100 });
      expect(result.lines).toBe(100);
    });

    it("rejects non-positive lines", () => {
      expect(() => schema.parse({ lines: 0 })).toThrow();
      expect(() => schema.parse({ lines: -5 })).toThrow();
    });
  });

  describe("kernelInfo (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("systemdServices", () => {
    const schema = z.object({
      unit: z.string().optional(),
      type: z.enum(["service", "timer", "socket", "mount"]).optional(),
    });

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result.unit).toBeUndefined();
      expect(result.type).toBeUndefined();
    });

    it("accepts specific unit", () => {
      const result = schema.parse({ unit: "docker.service" });
      expect(result.unit).toBe("docker.service");
    });

    it("accepts type filter", () => {
      const result = schema.parse({ type: "timer" });
      expect(result.type).toBe("timer");
    });

    it("rejects invalid type", () => {
      expect(() => schema.parse({ type: "target" })).toThrow();
    });
  });

  describe("certCheck", () => {
    const schema = z.object({
      domain: z.string().min(1),
    });

    it("requires domain", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts a domain", () => {
      const result = schema.parse({ domain: "example.com" });
      expect(result.domain).toBe("example.com");
    });

    it("accepts host:port format", () => {
      const result = schema.parse({ domain: "example.com:8443" });
      expect(result.domain).toBe("example.com:8443");
    });

    it("rejects empty domain", () => {
      expect(() => schema.parse({ domain: "" })).toThrow();
    });
  });

  describe("certRenew", () => {
    const schema = z.object({
      domain: z.string().optional(),
      confirm: z.boolean(),
    });

    it("requires confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts confirm only (renew all)", () => {
      const result = schema.parse({ confirm: true });
      expect(result.confirm).toBe(true);
      expect(result.domain).toBeUndefined();
    });

    it("accepts domain and confirm", () => {
      const result = schema.parse({ domain: "example.com", confirm: true });
      expect(result.domain).toBe("example.com");
      expect(result.confirm).toBe(true);
    });

    it("accepts confirm=false", () => {
      const result = schema.parse({ confirm: false });
      expect(result.confirm).toBe(false);
    });
  });

  describe("certList (no params)", () => {
    const schema = z.object({});

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });
});
