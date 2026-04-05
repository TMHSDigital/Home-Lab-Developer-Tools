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
});
