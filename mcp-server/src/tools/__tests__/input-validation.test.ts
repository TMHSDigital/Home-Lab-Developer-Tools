import { describe, it, expect } from "vitest";
import { z } from "zod";
import { TOOLS } from "../../tool-registry.js";

/**
 * Schemas are captured from each tool's real register() call, so these
 * tests fail when a tool's actual input schema changes.
 */
const REGISTRARS: Record<string, (server: never) => void> = TOOLS;

/** Tools that at least one test below captured a schema for. */
const covered = new Set<string>();

function schemaOf(tool: string) {
  const register = REGISTRARS[tool];
  if (!register) throw new Error(`unknown tool ${tool}`);
  covered.add(tool);
  let shape: z.ZodRawShape | undefined;
  const fakeServer = {
    registerTool: (_name: string, config: { inputSchema: z.ZodRawShape }) => {
      shape = config.inputSchema;
    },
  };
  register(fakeServer as never);
  if (!shape) throw new Error(`${tool} did not register a schema`);
  return z.object(shape);
}
describe("input validation schemas", () => {
  describe("grafanaImport", () => {
    const schema = schemaOf("grafanaImport");
    const valid = { dashboardJson: '{"title":"Pi"}', confirm: true };

    it("accepts a raw dashboard or snapshot export and defaults overwrite to false", () => {
      expect(schema.parse(valid).overwrite).toBe(false);
      expect(schema.parse({ ...valid, dashboardJson: '{"dashboard":{"title":"Pi","uid":null},"meta":{"folderUid":"lab"}}', folderUid: "", overwrite: true }).folderUid).toBe("");
    });

    it.each(["", "not json", "null", "[]", "42", "{}", '{"title":" "}', '{"title":42}', '{"title":"Pi","uid":5}', '{"dashboard":[]}', '{"dashboard":{"title":"Pi"},"meta":{"folderUid":5}}'])
      ("rejects an invalid dashboard: %s", (dashboardJson) => {
        expect(schema.safeParse({ ...valid, dashboardJson }).success).toBe(false);
      });

    it("measures the size cap in UTF-8 bytes and accepts the exact limit", () => {
      expect(schema.safeParse({ ...valid, dashboardJson: valid.dashboardJson.padEnd(1024 * 1024, " ") }).success).toBe(true);
      expect(schema.safeParse({ ...valid, dashboardJson: valid.dashboardJson.padEnd(1024 * 1024 + 1, " ") }).success).toBe(false);
      const dashboardJson = JSON.stringify({ title: "Pi", description: "台".repeat(350000) });
      expect(dashboardJson.length).toBeLessThan(1024 * 1024);
      expect(schema.safeParse({ ...valid, dashboardJson }).success).toBe(false);
    });

    it("requires confirm and rejects invalid overwrite or folder values", () => {
      expect(schema.safeParse({ dashboardJson: valid.dashboardJson }).success).toBe(false);
      expect(schema.safeParse({ ...valid, confirm: "yes" }).success).toBe(false);
      expect(schema.safeParse({ ...valid, overwrite: "yes" }).success).toBe(false);
      expect(schema.safeParse({ ...valid, folderUid: "x".repeat(41) }).success).toBe(false);
    });
  });

  describe("composePull", () => {
    const schema = schemaOf("composePull");

    it("accepts no stacks or a list of stack files", () => {
      expect(schema.parse({}).stacks).toBeUndefined();
      expect(schema.parse({ stacks: ["compose.apps.yml"] }).stacks).toEqual(["compose.apps.yml"]);
    });

    it("rejects a non-array stacks value", () => {
      expect(() => schema.parse({ stacks: "compose.apps.yml" })).toThrow();
      expect(() => schema.parse({ stacks: [1] })).toThrow();
    });
  });

  describe("serviceHealth", () => {
    const schema = schemaOf("serviceHealth");

    it("accepts an optional service filter and node all", () => {
      expect(schema.parse({}).service).toBeUndefined();
      expect(schema.parse({ service: "grafana", node: "all" }).service).toBe("grafana");
    });

    it("rejects a non-string service", () => {
      expect(() => schema.parse({ service: 5 })).toThrow();
    });
  });

  describe("uptimeKumaStatus", () => {
    const schema = schemaOf("uptimeKumaStatus");

    it("accepts a valid slug and defaults beats to 1", () => {
      const parsed = schema.parse({ slug: "home-lab-2" });
      expect(parsed.slug).toBe("home-lab-2");
      expect(parsed.beats).toBe(1);
    });

    it("rejects slugs with other characters and out-of-range beats", () => {
      for (const slug of ["Home", "a/b", "a b", "x'y"]) {
        expect(() => schema.parse({ slug }), slug).toThrow();
      }
      expect(() => schema.parse({ beats: 0 })).toThrow();
      expect(() => schema.parse({ beats: 101 })).toThrow();
    });
  });

  describe("serviceLogs", () => {
    const schema = schemaOf("serviceLogs");

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
    const schema = schemaOf("serviceRestart");

    it("rejects empty service name", () => {
      expect(() => schema.parse({ service: "", confirm: true })).toThrow();
    });

    it("accepts valid service name", () => {
      const result = schema.parse({ service: "nginx-proxy-manager", confirm: true });
      expect(result.service).toBe("nginx-proxy-manager");
    });

    it("rejects missing confirm", () => {
      expect(() => schema.parse({ service: "prometheus" })).toThrow();
    });

    it("rejects non-boolean confirm", () => {
      expect(() => schema.parse({ service: "prometheus", confirm: "yes" })).toThrow();
    });

    it("accepts boolean confirm", () => {
      const result = schema.parse({ service: "prometheus", confirm: true });
      expect(result.confirm).toBe(true);
    });
  });

  describe("piReboot", () => {
    const schema = schemaOf("piReboot");

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
    const schema = schemaOf("diskUsage");

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
    const schema = schemaOf("backupRun");

    it("rejects missing confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts confirm=false", () => {
      const result = schema.parse({ confirm: false });
      expect(result.confirm).toBe(false);
    });
  });

  describe("aptUpdate", () => {
    const schema = schemaOf("aptUpdate");

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
    const schema = schemaOf("backupStatus");

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
    const schema = schemaOf("composeUp");

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

    it("accepts empty stacks for all", () => {
      const result = schema.parse({ confirm: true });
      expect(result.stacks).toBeUndefined();
    });

    it("accepts specific stacks", () => {
      const result = schema.parse({ stacks: ["compose.monitoring.yml"], confirm: true });
      expect(result.stacks).toEqual(["compose.monitoring.yml"]);
    });
  });

  describe("composeDown", () => {
    const schema = schemaOf("composeDown");

    it("rejects missing confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("rejects non-boolean confirm", () => {
      expect(() => schema.parse({ confirm: "yes" })).toThrow();
    });

    it("accepts boolean confirm", () => {
      const result = schema.parse({ confirm: false });
      expect(result.confirm).toBe(false);
    });

    it("defaults removeVolumes to false", () => {
      const result = schema.parse({ confirm: true });
      expect(result.removeVolumes).toBe(false);
    });

    it("accepts removeVolumes=true", () => {
      const result = schema.parse({ confirm: true, removeVolumes: true });
      expect(result.removeVolumes).toBe(true);
    });
  });

  describe("prometheusQuery", () => {
    const schema = schemaOf("prometheusQuery");

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
    const schema = schemaOf("grafanaSnapshot");

    it("rejects empty dashboard UID", () => {
      expect(() => schema.parse({ dashboard: "" })).toThrow();
    });

    it("accepts valid dashboard UID", () => {
      const result = schema.parse({ dashboard: "abc123" });
      expect(result.dashboard).toBe("abc123");
    });
  });

  describe("alertSilences", () => {
    const schema = schemaOf("alertSilences");

    it("accepts silence states", () => {
      expect(schema.parse({ state: "expired" }).state).toBe("expired");
    });

    it("rejects alert states", () => {
      expect(() => schema.parse({ state: "firing" })).toThrow();
    });
  });

  describe("alertSilence", () => {
    const schema = schemaOf("alertSilence");
    const create = { action: "create", matchers: [{ name: "alertname", value: "HighCPU" }], comment: "maintenance", confirm: true };

    it("accepts a create request and fills defaults", () => {
      const result = schema.parse(create);
      expect(result.duration).toBe("2h");
      expect(result.createdBy).toBe("homelab-mcp");
      expect((result.matchers as unknown[])[0]).toEqual({ name: "alertname", value: "HighCPU", isRegex: false, isEqual: true });
    });

    it.each(["bad-name", "1x", "a b", ""])("rejects matcher name %j", (name) => {
      expect(() => schema.parse({ ...create, matchers: [{ name, value: "x" }] })).toThrow();
    });

    it.each(["2", "2w", "0h", "1.5h", "-1h"])("rejects duration %j", (duration) => {
      expect(() => schema.parse({ ...create, duration })).toThrow();
    });

    it("requires a UUID for the silence id", () => {
      expect(() => schema.parse({ action: "expire", id: "abc", confirm: true })).toThrow();
      expect(schema.parse({ action: "expire", id: "8e6c1b9a-6d1f-4c1e-9a43-0f5d2b7a9c10", confirm: true }).id).toBeDefined();
    });

    it("rejects unknown actions and requires confirm", () => {
      expect(() => schema.parse({ ...create, action: "delete" })).toThrow();
      expect(() => schema.parse({ action: "expire" })).toThrow();
    });
  });

  describe("alertList", () => {
    const schema = schemaOf("alertList");

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
    const schema = schemaOf("speedtestResults");

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
    const schema = schemaOf("adguardQueryLog");

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
    const schema = schemaOf("adguardStats");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("adguardFilterToggle", () => {
    const schema = schemaOf("adguardFilterToggle");

    it("requires url, enabled and confirm", () => {
      expect(() => schema.parse({ enabled: true, confirm: true })).toThrow();
      expect(() => schema.parse({ url: "https://l.example/a.txt", confirm: true })).toThrow();
      expect(() => schema.parse({ url: "https://l.example/a.txt", enabled: true })).toThrow();
    });

    it("rejects an empty url and non-boolean enabled", () => {
      expect(() => schema.parse({ url: "", enabled: true, confirm: true })).toThrow();
      expect(() => schema.parse({ url: "u", enabled: "yes", confirm: true })).toThrow();
    });

    it("accepts a full request", () => {
      const result = schema.parse({ url: "https://l.example/a.txt", enabled: false, confirm: true, node: "nas" });
      expect(result.enabled).toBe(false);
      expect(result.node).toBe("nas");
    });
  });

  describe("adguardFilters (no params)", () => {
    const schema = schemaOf("adguardFilters");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("npmProxyHosts (no params)", () => {
    const schema = schemaOf("npmProxyHosts");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("npmCerts (no params)", () => {
    const schema = schemaOf("npmCerts");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("backupList", () => {
    const schema = schemaOf("backupList");

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
    const schema = schemaOf("backupRestore");

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

  describe("systemdControl", () => {
    const schema = schemaOf("systemdControl");

    it("accepts unit names with instance and type suffixes", () => {
      for (const unit of ["smbd", "cockpit.socket", "getty@tty1.service", "restic-backup.timer", "dev-sda1.mount"]) {
        expect(schema.parse({ unit, action: "restart", confirm: true }).unit).toBe(unit);
      }
    });

    it("rejects unsafe unit names and unknown actions", () => {
      for (const unit of ["", "smbd; reboot", "a b", "x'y", "$(id)", "../etc"]) {
        expect(() => schema.parse({ unit, action: "restart", confirm: true }), unit).toThrow();
      }
      expect(() => schema.parse({ unit: "smbd", action: "mask", confirm: true })).toThrow();
    });
  });

  describe("backupCheck", () => {
    const schema = schemaOf("backupCheck");

    it("accepts no subset, a percentage or a part", () => {
      expect(schema.parse({}).readDataSubset).toBeUndefined();
      expect(schema.parse({ readDataSubset: "5%" }).readDataSubset).toBe("5%");
      expect(schema.parse({ readDataSubset: "2.5%" }).readDataSubset).toBe("2.5%");
      expect(schema.parse({ readDataSubset: "1/10" }).readDataSubset).toBe("1/10");
    });

    it("rejects malformed or unsafe subsets", () => {
      for (const bad of ["", "5", "500%", "0/10", "1/0", "5%'; rm -rf ~", "all"]) {
        expect(() => schema.parse({ readDataSubset: bad }), bad).toThrow();
      }
    });
  });

  describe("backupStatus maxAgeHours", () => {
    const schema = schemaOf("backupStatus");

    it("defaults to 26 hours and rejects non-positive values", () => {
      expect(schema.parse({}).maxAgeHours).toBe(26);
      expect(schema.parse({ maxAgeHours: 48 }).maxAgeHours).toBe(48);
      expect(() => schema.parse({ maxAgeHours: 0 })).toThrow();
    });
  });

  describe("backupDiff", () => {
    const schema = schemaOf("backupDiff");

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
    const schema = schemaOf("volumeBackup");

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
    const schema = schemaOf("ufwStatus");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("fail2banStatus", () => {
    const schema = schemaOf("fail2banStatus");

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
    const schema = schemaOf("openPorts");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("containerScan", () => {
    const schema = schemaOf("containerScan");

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
    const schema = schemaOf("journalLogs");

    it("accepts empty input with defaults", () => {
      const result = schema.parse({});
      expect(result.lines).toBe(50);
      expect(result.unit).toBeUndefined();
    });

    it("accepts all filters", () => {
      const result = schema.parse({ unit: "docker.service", priority: 3, since: "1h", lines: 200 });
      expect(result.unit).toBe("docker.service");
      expect(result.priority).toBe(3);
      expect(result.since).toBe("1h");
      expect(result.lines).toBe(200);
    });

    it("uses the shared since format", () => {
      expect(schema.parse({ since: "2026-11-18T10:00:00Z" }).since).toBe("2026-11-18T10:00:00Z");
      expect(() => schema.parse({ since: "1 hour ago; reboot" })).toThrow();
    });

    it("rejects priority out of range", () => {
      expect(() => schema.parse({ priority: 8 })).toThrow();
      expect(() => schema.parse({ priority: -1 })).toThrow();
    });
  });

  describe("logSearch", () => {
    const schema = schemaOf("logSearch");

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
    const schema = schemaOf("ntfySend");

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
    const schema = schemaOf("ntfyTopics");

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
    const schema = schemaOf("aptUpgradable");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("aptHistory", () => {
    const schema = schemaOf("aptHistory");

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
    const schema = schemaOf("kernelInfo");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("systemdServices", () => {
    const schema = schemaOf("systemdServices");

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
    const schema = schemaOf("certCheck");

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
    const schema = schemaOf("certRenew");

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
    const schema = schemaOf("certList");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("nodeList (no params)", () => {
    const schema = schemaOf("nodeList");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("nodeExec", () => {
    const schema = schemaOf("nodeExec");

    it("requires all three fields", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("requires node", () => {
      expect(() => schema.parse({ command: "ls", confirm: true })).toThrow();
    });

    it("requires command", () => {
      expect(() => schema.parse({ node: "pi5", confirm: true })).toThrow();
    });

    it("requires confirm", () => {
      expect(() => schema.parse({ node: "pi5", command: "ls" })).toThrow();
    });

    it("accepts valid input", () => {
      const result = schema.parse({ node: "pi5", command: "uptime", confirm: true });
      expect(result.node).toBe("pi5");
      expect(result.command).toBe("uptime");
      expect(result.confirm).toBe(true);
    });

    it("rejects empty node", () => {
      expect(() => schema.parse({ node: "", command: "ls", confirm: true })).toThrow();
    });

    it("rejects empty command", () => {
      expect(() => schema.parse({ node: "pi5", command: "", confirm: true })).toThrow();
    });
  });

  describe("nodeStatus", () => {
    const schema = schemaOf("nodeStatus");

    it("requires node", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts a node name", () => {
      const result = schema.parse({ node: "nas" });
      expect(result.node).toBe("nas");
    });

    it("rejects empty node", () => {
      expect(() => schema.parse({ node: "" })).toThrow();
    });
  });

  describe("inventorySync", () => {
    const schema = schemaOf("inventorySync");

    it("requires source", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts ansible", () => {
      const result = schema.parse({ source: "ansible" });
      expect(result.source).toBe("ansible");
    });

    it("accepts tailscale", () => {
      const result = schema.parse({ source: "tailscale" });
      expect(result.source).toBe("tailscale");
    });

    it("rejects invalid source", () => {
      expect(() => schema.parse({ source: "kubernetes" })).toThrow();
    });
  });

  describe("healthCheck", () => {
    const schema = schemaOf("healthCheck");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result.node).toBeUndefined();
    });

    it("accepts optional node", () => {
      const result = schema.parse({ node: "pi5" });
      expect(result.node).toBe("pi5");
    });
  });

  describe("diagnostics", () => {
    const schema = schemaOf("diagnostics");

    it("accepts empty input", () => {
      const result = schema.parse({});
      expect(result.node).toBeUndefined();
    });

    it("accepts optional node", () => {
      const result = schema.parse({ node: "nas" });
      expect(result.node).toBe("nas");
    });
  });
});

describe("input validation coverage", () => {
  it("has at least one case for every tool that takes more than a node", () => {
    const missing = Object.keys(REGISTRARS).filter((tool) => {
      let shape: z.ZodRawShape = {};
      REGISTRARS[tool]({
        registerTool: (_n: string, config: { inputSchema: z.ZodRawShape }) => {
          shape = config.inputSchema;
        },
      } as never);
      return Object.keys(shape).some((k) => k !== "node") && !covered.has(tool);
    });
    expect(missing).toEqual([]);
  });
});
