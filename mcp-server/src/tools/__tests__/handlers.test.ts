import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../utils/ssh-api.js", () => ({
  execSSH: vi.fn(),
  errorResponse: vi.fn((error: unknown) => ({
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Unknown error" }],
    isError: true,
  })),
  nodeSetting: vi.fn((_node: string | undefined, key: string) => process.env[key] || undefined),
  getNodeConfig: vi.fn(() => ({ host: "raspberrypi.local", username: "pi", keyPath: "", env: {} })),
  listNodes: vi.fn(() => [{ name: "default", host: "raspberrypi.local" }]),
  TIMEOUTS: { long: 1_800_000, backup: 3_600_000, medium: 300_000 },
}));

import { execSSH, nodeSetting, listNodes } from "../../utils/ssh-api.js";
import { CommandFailedError } from "../../utils/errors.js";
import { register as prometheusQuery } from "../prometheusQuery.js";
import { register as grafanaSnapshot } from "../grafanaSnapshot.js";
import { register as uptimeKumaStatus } from "../uptimeKumaStatus.js";
import { register as adguardStats } from "../adguardStats.js";
import { register as npmProxyHosts } from "../npmProxyHosts.js";
import { register as certCheck } from "../certCheck.js";
import { register as inventorySync } from "../inventorySync.js";
import { register as composePs } from "../composePs.js";
import { register as serviceHealth } from "../serviceHealth.js";
import { register as systemdServices } from "../systemdServices.js";
import { register as logSearch } from "../logSearch.js";
import { register as certRenew } from "../certRenew.js";
import { register as backupRun } from "../backupRun.js";
import { register as nodeStatus } from "../nodeStatus.js";
import { register as alertSilences } from "../alertSilences.js";
import { register as alertSilence, buildSilenceBody } from "../alertSilence.js";
import { register as backupStatus } from "../backupStatus.js";
import { register as backupList } from "../backupList.js";
import { register as backupDiff } from "../backupDiff.js";
import { register as backupRestore } from "../backupRestore.js";
import { register as volumeBackup } from "../volumeBackup.js";
import {
  register as adguardFilterToggle,
  buildSetUrlPayload,
  shellQuote,
} from "../adguardFilterToggle.js";

const mockExecSSH = vi.mocked(execSSH);
const ENV_KEYS = ["HOMELAB_GRAFANA_TOKEN", "HOMELAB_ADGUARD_PORT", "HOMELAB_COMPOSE_FILES", "HOMELAB_RESTIC_PASSWORD_FILE"];

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function handlerOf(register: (server: never) => void): Handler {
  let handler: Handler | null = null;
  register({
    tool: (_n: string, _d: string, _s: unknown, h: Handler) => {
      handler = h;
    },
  } as never);
  if (!handler) throw new Error("handler not captured");
  return handler;
}

const cmd = (i = 0) => String(mockExecSSH.mock.calls[i][0]);
const failed = (code: number) => new CommandFailedError("http", code, "");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("alert silences", () => {
  const silence = (id: string, state: string, endsAt: string) => ({
    id,
    status: { state },
    matchers: [
      { name: "alertname", value: "HighCPU", isRegex: false, isEqual: true },
      { name: "instance", value: "pi.*", isRegex: true, isEqual: false },
    ],
    startsAt: "2026-11-18T10:00:00Z",
    endsAt,
    createdBy: "ops",
    comment: "reboot",
  });

  it("lists silences compactly, active first, and filters by state", async () => {
    const body = JSON.stringify([
      silence("old", "expired", "2026-11-17T00:00:00Z"),
      silence("now", "active", "2026-11-18T12:00:00Z"),
    ]);
    mockExecSSH.mockResolvedValueOnce(body);
    const text = (await handlerOf(alertSilences)({})).content[0].text;
    expect(cmd()).toBe("curl -sf 'http://localhost:9093/api/v2/silences'");
    expect(text.split("\n")[0]).toBe(
      'now [active] {alertname="HighCPU", instance!~"pi.*"} 2026-11-18T10:00:00Z -> 2026-11-18T12:00:00Z by ops: reboot',
    );
    mockExecSSH.mockResolvedValueOnce(body);
    expect((await handlerOf(alertSilences)({ state: "pending" })).content[0].text).toBe("No pending silences.");
  });

  it("builds a silence body for the requested window", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const body = JSON.parse(buildSilenceBody({
      action: "create",
      matchers: [{ name: "alertname", value: "it's", isRegex: false, isEqual: true }],
      duration: "90m",
      comment: "maintenance",
    }, now));
    expect(body).toEqual({
      matchers: [{ name: "alertname", value: "it's", isRegex: false, isEqual: true }],
      startsAt: "2026-11-18T10:00:00.000Z",
      endsAt: "2026-11-18T11:30:00.000Z",
      createdBy: "homelab-mcp",
      comment: "maintenance",
    });
    expect(() => buildSilenceBody({ action: "create", matchers: [], comment: "x" }, now)).toThrow(/matcher/);
    expect(() => buildSilenceBody({ action: "create", matchers: body.matchers, duration: "31d", comment: "x" }, now)).toThrow(/30d/);
  });

  it("creates a silence with a safely quoted body and reports its id", async () => {
    mockExecSSH.mockResolvedValueOnce('{"silenceID":"8e6c1b9a-6d1f-4c1e-9a43-0f5d2b7a9c10"}');
    const result = await handlerOf(alertSilence)({
      action: "create",
      matchers: [{ name: "alertname", value: "it's" }],
      comment: "maintenance",
      confirm: true,
    });
    expect(cmd()).toContain("curl -sf -X POST -H 'Content-Type: application/json' -d '{");
    expect(cmd()).toContain(String.raw`it'\''s`);
    expect(cmd()).toContain("'http://localhost:9093/api/v2/silences'");
    expect(result.content[0].text).toContain("Silence 8e6c1b9a-6d1f-4c1e-9a43-0f5d2b7a9c10 created for 2h");
  });

  it("expires a silence by id", async () => {
    mockExecSSH.mockResolvedValueOnce("");
    const id = "8e6c1b9a-6d1f-4c1e-9a43-0f5d2b7a9c10";
    const result = await handlerOf(alertSilence)({ action: "expire", id, confirm: true });
    expect(cmd()).toBe(`curl -sf -X DELETE 'http://localhost:9093/api/v2/silence/${id}'`);
    expect(result.content[0].text).toBe(`Silence ${id} expired.`);
  });

  it("explains a missing comment instead of calling Alertmanager", async () => {
    const result = await handlerOf(alertSilence)({ action: "create", matchers: [{ name: "a", value: "b" }], confirm: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("needs a comment");
    expect(mockExecSSH).not.toHaveBeenCalled();
  });
});

describe("restic tools", () => {
  it.each([
    ["backupStatus", backupStatus, {}],
    ["backupList", backupList, {}],
    ["backupDiff", backupDiff, { snapshotA: "aaa", snapshotB: "bbb" }],
    ["backupRestore", backupRestore, { snapshot: "aaa", target: "/tmp/r", confirm: true }],
    ["volumeBackup", volumeBackup, { volume: "grafana_data", confirm: true }],
  ] as const)("%s loads the restic env file and passes the password file", async (_name, register, args) => {
    process.env.HOMELAB_RESTIC_PASSWORD_FILE = "/root/.restic-pass";
    mockExecSSH.mockResolvedValueOnce("[]");
    await handlerOf(register)({ ...args });
    expect(cmd()).toContain(`exec restic "$@"' '/etc/restic-env' -r '/mnt/backup/restic' --password-file '/root/.restic-pass' `);
  });

  it("names the password settings when restic cannot get a password", async () => {
    mockExecSSH.mockRejectedValueOnce(
      new CommandFailedError("restic", 1, "Fatal: an empty password is not allowed by default"),
    );
    const result = await handlerOf(backupDiff)({ snapshotA: "aaa", snapshotB: "bbb" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HOMELAB_RESTIC_ENV_FILE");
  });
});

describe("bounded JSON output", () => {
  const snap = (id: string, time: string) =>
    ({ short_id: id, id: id + "0000", time, hostname: "pi", paths: ["/opt"], tags: null });

  it("backupList returns the newest snapshots, compact, up to count", async () => {
    mockExecSSH.mockResolvedValueOnce(JSON.stringify([
      snap("aaa", "2026-01-01T00:00:00Z"),
      snap("ccc", "2026-03-01T00:00:00Z"),
      snap("bbb", "2026-02-01T00:00:00Z"),
    ]));
    const text = (await handlerOf(backupList)({ count: 2 })).content[0].text;
    const lines = text.split("\n");
    expect(lines[0]).toBe("Showing the newest 2 of 3 snapshots. Raise count or add filters to see more.");
    expect(JSON.parse(lines[1])).toEqual({ id: "ccc", time: "2026-03-01T00:00:00Z", host: "pi", paths: ["/opt"], tags: [] });
    expect(JSON.parse(lines[2]).id).toBe("bbb");
    expect(lines).toHaveLength(3);
  });

  it("backupList defaults to 20 snapshots", async () => {
    const many = Array.from({ length: 25 }, (_, i) => snap(`s${i}`, new Date(Date.UTC(2026, 0, i + 1)).toISOString()));
    mockExecSSH.mockResolvedValueOnce(JSON.stringify(many));
    const text = (await handlerOf(backupList)({})).content[0].text;
    expect(text.split("\n")).toHaveLength(21);
  });

  it.each([
    ["backupList", () => backupList, {}],
    ["prometheusQuery", () => prometheusQuery, { query: "up" }],
    ["npmProxyHosts", () => npmProxyHosts, {}],
  ] as const)("%s reports cut JSON instead of returning it", async (name, get, args) => {
    if (name === "npmProxyHosts") mockExecSSH.mockResolvedValueOnce('{"token":"t"}');
    mockExecSSH.mockResolvedValueOnce('[output truncated: showing last 10 of 2000000 bytes]\n"x": 1}]');
    const result = await handlerOf(get())({ ...args });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("larger than HOMELAB_MAX_OUTPUT_BYTES");
  });

  it("prometheusQuery keeps at most limit series and stays valid JSON", async () => {
    const result = Array.from({ length: 5 }, (_, i) => ({ metric: { i: String(i) }, value: [0, "1"] }));
    mockExecSSH.mockResolvedValueOnce(JSON.stringify({ status: "success", data: { resultType: "vector", result } }));
    const body = JSON.parse((await handlerOf(prometheusQuery)({ query: "up", limit: 2 })).content[0].text);
    expect(body.data.result).toHaveLength(2);
    expect(body.note).toBe("Showing the first 2 of 5 series. Narrow the query or raise limit.");
  });
});

describe('node: "all" fan-out', () => {
  const fleet = [
    { name: "default", host: "raspberrypi.local", port: 22 },
    { name: "nas", host: "nas.local", port: 22 },
    { name: "zero", host: "zero.local", port: 22 },
  ];

  it("nodeStatus reports every node, with per-node errors for offline ones", async () => {
    vi.mocked(listNodes).mockReturnValueOnce(fleet);
    mockExecSSH.mockImplementation(async (_cmd, node) => {
      if (node === "zero") throw new Error("Cannot connect to zero.local\nmore detail");
      return `up on ${node ?? "default"}`;
    });
    const result = await handlerOf(nodeStatus)({ node: "all" });
    expect(result.isError).toBeUndefined();
    expect(mockExecSSH.mock.calls.map((c) => c[1])).toEqual([undefined, "nas", "zero"]);
    expect(result.content[0].text).toBe(
      "2 of 3 nodes responded.\n\n" +
        "=== default (raspberrypi.local) ===\nup on default\n\n" +
        "=== nas (nas.local) ===\nup on nas\n\n" +
        "=== zero (zero.local) ===\nError: Cannot connect to zero.local",
    );
    mockExecSSH.mockReset();
  });

  it("serviceHealth fans out and is an error only when every node fails", async () => {
    const row = JSON.stringify({ Names: "web", State: "exited", Status: "Exited (1)", Ports: "" });
    vi.mocked(listNodes).mockReturnValueOnce(fleet.slice(0, 2));
    mockExecSSH.mockResolvedValueOnce(row).mockRejectedValueOnce(new Error("timeout"));
    const mixed = await handlerOf(serviceHealth)({ node: "all" });
    expect(mixed.isError).toBeUndefined();
    expect(mixed.content[0].text).toContain("=== default (raspberrypi.local) ===\nNAMES\tSTATUS\tPORTS");
    expect(mixed.content[0].text).toContain("Containers needing attention: web");
    expect(mixed.content[0].text).toContain("=== nas (nas.local) ===\nError: timeout");

    vi.mocked(listNodes).mockReturnValueOnce(fleet.slice(0, 2));
    mockExecSSH.mockRejectedValueOnce(new Error("down")).mockRejectedValueOnce(new Error("down"));
    const allDown = await handlerOf(serviceHealth)({ node: "all" });
    expect(allDown.isError).toBe(true);
    expect(allDown.content[0].text).toContain("0 of 2 nodes responded.");
  });

  it("keeps single-node behavior for a named node", async () => {
    mockExecSSH.mockResolvedValueOnce("up");
    const result = await handlerOf(nodeStatus)({ node: "nas" });
    expect(result.content[0].text).toBe("up");
    expect(mockExecSSH.mock.calls[0][1]).toBe("nas");
  });
});

describe("serviceHealth", () => {
  const row = (name: string, state: string, status: string) =>
    JSON.stringify({ Names: name, State: state, Status: status, Ports: "80/tcp" });

  it.each(["exited", "dead", "restarting", "created", "paused", "removing"])(
    "reports %s containers as problems alongside running containers",
    async (state) => {
      mockExecSSH.mockResolvedValueOnce([
        row("web", "running", "Up 2 hours (healthy)"),
        row("worker", state, state),
      ].join("\n"));
      const result = await handlerOf(serviceHealth)({ node: "lab" });
      expect(result.content[0].text).toContain("Containers needing attention: worker");
      expect(result.content[0].text).not.toContain("All containers healthy");
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
      expect(cmd()).toContain("docker ps -a");
      expect(mockExecSSH.mock.calls[0][1]).toBe("lab");
    },
  );

  it.each(["unhealthy", "health: starting"])("reports running containers with %s checks", async (health) => {
    mockExecSSH.mockResolvedValueOnce(row("web", "running", `Up 2 minutes (${health})`));
    const result = await handlerOf(serviceHealth)({});
    expect(result.content[0].text).toContain("Containers needing attention: web");
  });

  it("reports an empty selection without claiming it is healthy", async () => {
    mockExecSSH.mockResolvedValueOnce("");
    const result = await handlerOf(serviceHealth)({ service: "missing" });
    expect(result.content[0].text).toBe('No containers matched "missing".');
    expect(cmd()).toContain("--filter 'name=missing'");
    expect(mockExecSSH).toHaveBeenCalledTimes(1);
  });

  it("reports no containers when the unfiltered list is empty", async () => {
    mockExecSSH.mockResolvedValueOnce("\n");
    expect((await handlerOf(serviceHealth)({})).content[0].text).toBe("No containers found.");
  });

  it("quotes the service filter as one shell argument", async () => {
    mockExecSSH.mockResolvedValueOnce("");
    await handlerOf(serviceHealth)({ service: "web'$(id)" });
    expect(cmd()).toContain("--filter 'name=web'\\''$(id)'");
  });

  it("keeps the container table and reports a problem-free running set", async () => {
    mockExecSSH.mockResolvedValueOnce(row("web", "running", "Up 2 hours (healthy)"));
    const result = await handlerOf(serviceHealth)({});
    expect(result.content[0].text).toContain("NAMES\tSTATUS\tPORTS\nweb\tUp 2 hours (healthy)\t80/tcp");
    expect(result.content[0].text).toContain("No container problems detected.");
  });

  it("preserves the dry-run description without claiming a health result", async () => {
    const description = "[dry-run] would execute on raspberrypi.local: docker ps -a";
    mockExecSSH.mockResolvedValueOnce(description);
    expect((await handlerOf(serviceHealth)({})).content[0].text).toBe(description);
  });

  it("does not report malformed output as healthy", async () => {
    mockExecSSH.mockResolvedValueOnce("not JSON");
    expect((await handlerOf(serviceHealth)({})).isError).toBe(true);
  });
});

describe("prometheusQuery", () => {
  it("URL-encodes the query and returns the API response", async () => {
    mockExecSSH.mockResolvedValueOnce('{"status":"success"}');
    const result = await handlerOf(prometheusQuery)({ query: 'up{job="node"}' });
    expect(result.content[0].text).toBe('{"status":"success"}');
    expect(cmd()).toContain("localhost:9090/api/v1/query?query=up%7Bjob%3D%22node%22%7D");
  });

  it("maps connection and HTTP errors", async () => {
    const h = handlerOf(prometheusQuery);
    mockExecSSH.mockRejectedValueOnce(failed(7));
    expect((await h({ query: "up" })).content[0].text).toContain("Could not connect to Prometheus on port 9090");
    mockExecSSH.mockRejectedValueOnce(failed(22));
    expect((await h({ query: "up(" })).content[0].text).toContain("Check the PromQL expression");
  });
});

describe("grafanaSnapshot", () => {
  it("uses a bearer token when HOMELAB_GRAFANA_TOKEN is set", async () => {
    process.env.HOMELAB_GRAFANA_TOKEN = "test-token";
    mockExecSSH.mockResolvedValueOnce("{}");
    await handlerOf(grafanaSnapshot)({ dashboard: "abc123" });
    expect(cmd()).toContain("Authorization: Bearer test-token");
    expect(cmd()).toContain("/api/dashboards/uid/abc123");
  });

  it("mentions the dashboard UID on HTTP errors", async () => {
    mockExecSSH.mockRejectedValueOnce(failed(22));
    const result = await handlerOf(grafanaSnapshot)({ dashboard: "missing-uid" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('dashboard UID "missing-uid"');
  });
});

describe("uptimeKumaStatus", () => {
  it("queries the requested status page slug", async () => {
    mockExecSSH.mockResolvedValueOnce('{"heartbeatList":{}}');
    await handlerOf(uptimeKumaStatus)({ slug: "homelab" });
    expect(cmd()).toContain("localhost:3001/api/status-page/heartbeat/homelab");
  });

  it("explains a missing status page", async () => {
    mockExecSSH.mockRejectedValueOnce(failed(22));
    const result = await handlerOf(uptimeKumaStatus)({});
    expect(result.content[0].text).toContain('status page "default"');
  });
});

describe("adguardStats", () => {
  it("honors HOMELAB_ADGUARD_PORT", async () => {
    process.env.HOMELAB_ADGUARD_PORT = "8053";
    mockExecSSH.mockResolvedValueOnce('{"num_dns_queries":1}');
    const result = await handlerOf(adguardStats)({});
    expect(result.content[0].text).toContain("num_dns_queries");
    expect(cmd()).toContain("localhost:8053/control/stats");
  });

  it("rejects an invalid port setting without running anything", async () => {
    process.env.HOMELAB_ADGUARD_PORT = "not-a-port";
    const result = await handlerOf(adguardStats)({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HOMELAB_ADGUARD_PORT must be a port number");
    expect(mockExecSSH).not.toHaveBeenCalled();
  });
});

describe("npmProxyHosts", () => {
  it("logs in, then lists proxy hosts with the token", async () => {
    mockExecSSH.mockResolvedValueOnce('{"token":"tok-1"}').mockResolvedValueOnce('[{"id":1}]');
    const result = await handlerOf(npmProxyHosts)({});
    expect(result.content[0].text).toBe('[{"id":1}]');
    expect(cmd(0)).toContain("/api/tokens");
    expect(cmd(1)).toContain("Authorization: Bearer tok-1");
    expect(cmd(1)).toContain("/api/nginx/proxy-hosts");
  });

  it("reports a non-JSON login response", async () => {
    mockExecSSH.mockResolvedValueOnce("<html>login</html>");
    const result = await handlerOf(npmProxyHosts)({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("non-JSON");
  });
});

describe("certCheck", () => {
  it("defaults to port 443 and uses the host for SNI", async () => {
    mockExecSSH.mockResolvedValueOnce("subject=CN = example.org");
    await handlerOf(certCheck)({ domain: "example.org" });
    expect(cmd()).toContain("-servername 'example.org'");
    expect(cmd()).toContain("-connect 'example.org:443'");
  });

  it("keeps an explicit port", async () => {
    mockExecSSH.mockResolvedValueOnce("subject=CN = example.org");
    await handlerOf(certCheck)({ domain: "example.org:8443" });
    expect(cmd()).toContain("-connect 'example.org:8443'");
  });

  it("explains certificate retrieval failures and retains the diagnostic", async () => {
    mockExecSSH.mockRejectedValueOnce(new CommandFailedError("openssl x509", 1, "Could not read certificate"));
    const result = await handlerOf(certCheck)({ domain: "example.org" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Could not retrieve certificate for example.org");
    expect(result.content[0].text).toContain("Could not read certificate");
  });

  it("preserves connection failures without mislabeling them as certificate errors", async () => {
    mockExecSSH.mockRejectedValueOnce(new Error("SSH authentication failed"));
    const result = await handlerOf(certCheck)({ domain: "example.org" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("SSH authentication failed");
  });
});

describe("systemdServices", () => {
  it("returns an inactive unit's status as a successful read", async () => {
    const status = "backup.service\n   Active: inactive (dead)";
    mockExecSSH.mockRejectedValueOnce(new CommandFailedError("systemctl status", 3, status));
    const result = await handlerOf(systemdServices)({ unit: "backup.service", node: "lab" });
    expect(result.isError).not.toBe(true);
    expect(result.content[0].text).toBe(status);
    expect(mockExecSSH.mock.calls[0][1]).toBe("lab");
  });

  it.each([1, 4])("keeps exit %i for a requested unit as an error", async (code) => {
    mockExecSSH.mockRejectedValueOnce(new CommandFailedError("systemctl status", code, "status unavailable"));
    expect((await handlerOf(systemdServices)({ unit: "missing.service" })).isError).toBe(true);
  });

  it("does not suppress exit 3 when listing units", async () => {
    mockExecSSH.mockRejectedValueOnce(failed(3));
    expect((await handlerOf(systemdServices)({})).isError).toBe(true);
  });
});

describe("inventorySync", () => {
  it("reads the Ansible inventory or Tailscale peers", async () => {
    const h = handlerOf(inventorySync);
    mockExecSSH.mockResolvedValueOnce("[pis]\npi1");
    expect((await h({ source: "ansible" })).content[0].text).toContain("=== Ansible Inventory (/etc/ansible/hosts) ===");
    mockExecSSH.mockResolvedValueOnce("100.64.0.1 pi1");
    expect((await h({ source: "tailscale" })).content[0].text).toContain("=== Tailscale Peers ===");
  });

  it("uses the node's HOMELAB_ANSIBLE_INVENTORY override", async () => {
    vi.mocked(nodeSetting).mockImplementationOnce((node, key) =>
      node === "lab" && key === "HOMELAB_ANSIBLE_INVENTORY" ? "/srv/ansible/hosts" : undefined,
    );
    mockExecSSH.mockResolvedValueOnce("[pis]");
    const text = (await handlerOf(inventorySync)({ source: "ansible", node: "lab" })).content[0].text;
    expect(cmd()).toContain("cat '/srv/ansible/hosts'");
    expect(text).toContain("=== Ansible Inventory (/srv/ansible/hosts) ===");
  });
});

describe("logSearch", () => {
  it("passes the pattern as data so the command guard allows words like poweroff", async () => {
    const { assertCommandSafe } = await vi.importActual<typeof import("../../utils/ssh-api.js")>("../../utils/ssh-api.js");
    mockExecSSH.mockResolvedValue("");
    for (const args of [{ pattern: "poweroff" }, { pattern: "system halt", service: "web" }]) {
      mockExecSSH.mockClear();
      await handlerOf(logSearch)(args);
      expect(() => assertCommandSafe(cmd())).not.toThrow();
      expect(cmd()).toContain(Buffer.from(args.pattern).toString("base64"));
      expect(cmd()).toContain('grep -i -e "$pat"');
    }
  });
});

describe("backupRun", () => {
  it("runs the node's HOMELAB_BACKUP_SCRIPT", async () => {
    vi.mocked(nodeSetting).mockImplementation((node, key) =>
      node === "nas" && key === "HOMELAB_BACKUP_SCRIPT" ? "/srv/scripts/restic-backup.sh" : undefined,
    );
    try {
      mockExecSSH.mockResolvedValueOnce("done");
      await handlerOf(backupRun)({ node: "nas", confirm: true });
      expect(cmd()).toContain("sudo test -x '/srv/scripts/restic-backup.sh'");
      expect(cmd()).toContain("out=$(sudo '/srv/scripts/restic-backup.sh' 2>&1)");
      expect(mockExecSSH.mock.calls[0][1]).toBe("nas");
    } finally {
      vi.mocked(nodeSetting).mockImplementation((_n, key) => process.env[key] || undefined);
    }
  });

  it("rejects a relative or unusual script path without running anything", async () => {
    process.env.HOMELAB_BACKUP_SCRIPT = "backup.sh; id";
    try {
      const result = await handlerOf(backupRun)({ confirm: true });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("HOMELAB_BACKUP_SCRIPT must be an absolute path");
      expect(mockExecSSH).not.toHaveBeenCalled();
    } finally {
      delete process.env.HOMELAB_BACKUP_SCRIPT;
    }
  });
});

describe("certRenew", () => {
  it("renews a named certificate only when due unless force is set", async () => {
    mockExecSSH.mockResolvedValue("installed");
    await handlerOf(certRenew)({ domain: "example.org", confirm: true });
    expect(cmd(1)).toBe("sudo certbot renew --cert-name 'example.org' 2>&1");
    mockExecSSH.mockClear();
    await handlerOf(certRenew)({ domain: "example.org", force: true, confirm: true });
    expect(cmd(1)).toBe("sudo certbot renew --cert-name 'example.org' --force-renewal 2>&1");
  });
});

describe("adguardFilterToggle", () => {
  const status = JSON.stringify({
    filters: [
      { url: "https://lists.example/ads.txt", name: "Ads", enabled: true },
      { url: "https://lists.example/old.txt", name: "Old", enabled: false },
    ],
    whitelist_filters: [{ url: "https://lists.example/allow.txt", name: "Allow", enabled: true }],
  });

  it("looks the filter up by URL and posts set_url with the new state", async () => {
    mockExecSSH.mockResolvedValueOnce(status).mockResolvedValueOnce("OK");
    const result = await handlerOf(adguardFilterToggle)({
      url: "https://lists.example/ads.txt",
      enabled: false,
      confirm: true,
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Filter "Ads" (https://lists.example/ads.txt) disabled.');
    expect(cmd(0)).toContain("/control/filtering/status");
    expect(cmd(1)).toContain("/control/filtering/set_url");
    expect(cmd(1)).toContain('"enabled":false');
    expect(cmd(1)).toContain('"whitelist":false');
  });

  it("handles allowlist filters", async () => {
    mockExecSSH.mockResolvedValueOnce(status).mockResolvedValueOnce("OK");
    await handlerOf(adguardFilterToggle)({ url: "https://lists.example/allow.txt", enabled: false, confirm: true });
    expect(cmd(1)).toContain('"whitelist":true');
  });

  it("does nothing when the filter is already in the requested state", async () => {
    mockExecSSH.mockResolvedValueOnce(status);
    const result = await handlerOf(adguardFilterToggle)({
      url: "https://lists.example/old.txt",
      enabled: false,
      confirm: true,
    });
    expect(result.content[0].text).toContain("already disabled");
    expect(mockExecSSH).toHaveBeenCalledTimes(1);
  });

  it("reports an unknown URL", async () => {
    mockExecSSH.mockResolvedValueOnce(status);
    const result = await handlerOf(adguardFilterToggle)({
      url: "https://lists.example/missing.txt",
      enabled: true,
      confirm: true,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("homelab_adguardFilters");
    expect(mockExecSSH).toHaveBeenCalledTimes(1);
  });

  it("quotes the payload so filter names with quotes stay intact", () => {
    const payload = buildSetUrlPayload({ url: "u", name: "Bob's list", enabled: true }, false, false);
    expect(shellQuote(payload)).toBe(`'${payload.replace(/'/g, "'\\''")}'`);
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
  });
});

describe("composePs", () => {
  it("lists containers across the configured compose files", async () => {
    process.env.HOMELAB_COMPOSE_FILES = "compose.base.yml,compose.apps.yml";
    mockExecSSH.mockResolvedValueOnce("NAME STATUS PORTS");
    const result = await handlerOf(composePs)({});
    expect(result.content[0].text).toContain("NAME");
    expect(cmd()).toContain("docker compose -f compose.base.yml -f compose.apps.yml ps");
  });
});
