import { describe, it, expect, afterEach } from "vitest";
import { SERVICES, servicePort, curlErrorResponse, setting } from "../service-http.js";
import { CommandFailedError } from "../errors.js";

const KEYS = ["HOMELAB_NPM_PORT", "HOMELAB_NODES", "HOMELAB_ADGUARD_USER"];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("servicePort", () => {
  it("returns the default when unset", () => {
    expect(servicePort(SERVICES.npm)).toBe(81);
  });

  it("reads the env override", () => {
    process.env.HOMELAB_NPM_PORT = "8181";
    expect(servicePort(SERVICES.npm)).toBe(8181);
  });

  it("prefers a per-node override", () => {
    process.env.HOMELAB_NPM_PORT = "8181";
    process.env.HOMELAB_NODES = JSON.stringify({
      nas: { host: "nas.local", env: { HOMELAB_NPM_PORT: "9181" } },
    });
    expect(servicePort(SERVICES.npm, "nas")).toBe(9181);
    expect(servicePort(SERVICES.npm)).toBe(8181);
  });

  it.each(["abc", "0", "70000", "81.5"])("rejects invalid port %j", (value) => {
    process.env.HOMELAB_NPM_PORT = value;
    expect(() => servicePort(SERVICES.npm)).toThrow(/HOMELAB_NPM_PORT must be a port number/);
  });
});

describe("setting", () => {
  it("falls back when unset", () => {
    expect(setting(undefined, "HOMELAB_ADGUARD_USER", "admin")).toBe("admin");
    process.env.HOMELAB_ADGUARD_USER = "dns-admin";
    expect(setting(undefined, "HOMELAB_ADGUARD_USER", "admin")).toBe("dns-admin");
  });
});

describe("curlErrorResponse", () => {
  const text = (r: { content: { text: string }[] }) => r.content[0].text;

  it("maps exit 7 to a connection message naming the port env var", () => {
    const r = curlErrorResponse(new CommandFailedError("curl", 7, ""), SERVICES.prometheus, 9090);
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("Could not connect to Prometheus on port 9090");
    expect(text(r)).toContain("HOMELAB_PROMETHEUS_PORT");
  });

  it("maps exit 22 to the service auth hint, or a custom message", () => {
    const r = curlErrorResponse(new CommandFailedError("curl", 22, ""), SERVICES.npm, 81);
    expect(text(r)).toContain("HOMELAB_NPM_EMAIL");
    const custom = curlErrorResponse(new CommandFailedError("curl", 22, ""), SERVICES.ntfy, 8080, {
      httpError: "custom 22",
    });
    expect(text(custom)).toBe("custom 22");
  });

  it("maps exit 28 to a timeout message and bad JSON to a parse message", () => {
    expect(text(curlErrorResponse(new CommandFailedError("curl", 28, ""), SERVICES.ntfy, 8080))).toContain(
      "did not respond in time",
    );
    expect(text(curlErrorResponse(new SyntaxError("bad"), SERVICES.npm, 81))).toContain("non-JSON");
  });

  it("passes other errors through", () => {
    const r = curlErrorResponse(new Error("boom"), SERVICES.ntfy, 8080);
    expect(text(r)).toBe("boom");
  });
});
