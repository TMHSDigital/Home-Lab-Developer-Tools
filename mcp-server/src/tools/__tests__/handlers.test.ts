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

import { execSSH } from "../../utils/ssh-api.js";
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
import {
  register as adguardFilterToggle,
  buildSetUrlPayload,
  shellQuote,
} from "../adguardFilterToggle.js";

const mockExecSSH = vi.mocked(execSSH);
const ENV_KEYS = ["HOMELAB_GRAFANA_TOKEN", "HOMELAB_ADGUARD_PORT", "HOMELAB_COMPOSE_FILES"];

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
});

describe("inventorySync", () => {
  it("reads the Ansible inventory or Tailscale peers", async () => {
    const h = handlerOf(inventorySync);
    mockExecSSH.mockResolvedValueOnce("[pis]\npi1");
    expect((await h({ source: "ansible" })).content[0].text).toContain("=== Ansible Inventory (/etc/ansible/hosts) ===");
    mockExecSSH.mockResolvedValueOnce("100.64.0.1 pi1");
    expect((await h({ source: "tailscale" })).content[0].text).toContain("=== Tailscale Peers ===");
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
