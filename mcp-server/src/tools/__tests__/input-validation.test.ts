import { describe, it, expect } from "vitest";
import { z } from "zod";
import { register as adguardFilters } from "../adguardFilters.js";
import { register as adguardFilterToggle } from "../adguardFilterToggle.js";
import { register as adguardQueryLog } from "../adguardQueryLog.js";
import { register as adguardStats } from "../adguardStats.js";
import { register as alertList } from "../alertList.js";
import { register as aptHistory } from "../aptHistory.js";
import { register as aptUpdate } from "../aptUpdate.js";
import { register as aptUpgradable } from "../aptUpgradable.js";
import { register as backupDiff } from "../backupDiff.js";
import { register as backupList } from "../backupList.js";
import { register as backupRestore } from "../backupRestore.js";
import { register as backupRun } from "../backupRun.js";
import { register as backupStatus } from "../backupStatus.js";
import { register as certCheck } from "../certCheck.js";
import { register as certList } from "../certList.js";
import { register as certRenew } from "../certRenew.js";
import { register as composeDown } from "../composeDown.js";
import { register as composeUp } from "../composeUp.js";
import { register as containerScan } from "../containerScan.js";
import { register as diagnostics } from "../diagnostics.js";
import { register as diskUsage } from "../diskUsage.js";
import { register as fail2banStatus } from "../fail2banStatus.js";
import { register as grafanaSnapshot } from "../grafanaSnapshot.js";
import { register as healthCheck } from "../healthCheck.js";
import { register as inventorySync } from "../inventorySync.js";
import { register as journalLogs } from "../journalLogs.js";
import { register as kernelInfo } from "../kernelInfo.js";
import { register as logSearch } from "../logSearch.js";
import { register as nodeExec } from "../nodeExec.js";
import { register as nodeList } from "../nodeList.js";
import { register as nodeStatus } from "../nodeStatus.js";
import { register as npmCerts } from "../npmCerts.js";
import { register as npmProxyHosts } from "../npmProxyHosts.js";
import { register as ntfySend } from "../ntfySend.js";
import { register as ntfyTopics } from "../ntfyTopics.js";
import { register as openPorts } from "../openPorts.js";
import { register as piReboot } from "../piReboot.js";
import { register as prometheusQuery } from "../prometheusQuery.js";
import { register as serviceLogs } from "../serviceLogs.js";
import { register as serviceRestart } from "../serviceRestart.js";
import { register as speedtestResults } from "../speedtestResults.js";
import { register as systemdServices } from "../systemdServices.js";
import { register as ufwStatus } from "../ufwStatus.js";
import { register as volumeBackup } from "../volumeBackup.js";

/**
 * Schemas are captured from each tool's real register() call, so these
 * tests fail when a tool's actual input schema changes.
 */
const REGISTRARS: Record<string, (server: never) => void> = {
  adguardFilters,
  adguardFilterToggle,
  adguardQueryLog,
  adguardStats,
  alertList,
  aptHistory,
  aptUpdate,
  aptUpgradable,
  backupDiff,
  backupList,
  backupRestore,
  backupRun,
  backupStatus,
  certCheck,
  certList,
  certRenew,
  composeDown,
  composeUp,
  containerScan,
  diagnostics,
  diskUsage,
  fail2banStatus,
  grafanaSnapshot,
  healthCheck,
  inventorySync,
  journalLogs,
  kernelInfo,
  logSearch,
  nodeExec,
  nodeList,
  nodeStatus,
  npmCerts,
  npmProxyHosts,
  ntfySend,
  ntfyTopics,
  openPorts,
  piReboot,
  prometheusQuery,
  serviceLogs,
  serviceRestart,
  speedtestResults,
  systemdServices,
  ufwStatus,
  volumeBackup,
};

function schemaOf(tool: string) {
  const register = REGISTRARS[tool];
  if (!register) throw new Error(`unknown tool ${tool}`);
  let shape: z.ZodRawShape | undefined;
  const fakeServer = {
    tool: (_name: string, _desc: string, schema: z.ZodRawShape) => {
      shape = schema;
    },
  };
  register(fakeServer as never);
  if (!shape) throw new Error(`${tool} did not register a schema`);
  return z.object(shape);
}
describe("input validation schemas", () => {
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
