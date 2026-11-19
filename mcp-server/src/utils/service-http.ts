/**
 * Shared helpers for tools that call a service's HTTP API with curl on the
 * node: port and credential lookup (per-node overridable via HOMELAB_NODES
 * env), Nginx Proxy Manager login, and curl exit-code mapping.
 */
import { execSSH, errorResponse, nodeSetting } from "./ssh-api.js";
import { CommandFailedError } from "./errors.js";

/**
 * Percent-encode a URL query value for a single-quoted curl URL.
 * encodeURIComponent leaves ! ' ( ) * as-is; a bare ' would end the shell
 * quoting, so those are encoded too.
 */
export function encodeQueryValue(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface ServiceDef {
  /** Human-readable service name used in messages. */
  name: string;
  /** Env var that overrides the port. */
  portEnv: string;
  defaultPort: number;
  /** Appended to HTTP-error (curl exit 22) messages, e.g. which credentials to check. */
  authHint?: string;
}

export const SERVICES = {
  adguard: {
    name: "AdGuard Home",
    portEnv: "HOMELAB_ADGUARD_PORT",
    defaultPort: 3000,
    authHint:
      "Check authentication -- set HOMELAB_ADGUARD_USER and HOMELAB_ADGUARD_PASSWORD. Also check the port: " +
      "AdGuard Home and Grafana both default to 3000, so if Grafana uses it, " +
      "set HOMELAB_ADGUARD_PORT to the AdGuard web UI port.",
  },
  grafana: {
    name: "Grafana",
    portEnv: "HOMELAB_GRAFANA_PORT",
    defaultPort: 3000,
    authHint:
      "Check authentication -- set HOMELAB_GRAFANA_TOKEN (API key) or HOMELAB_GRAFANA_USER/HOMELAB_GRAFANA_PASSWORD.",
  },
  npm: {
    name: "Nginx Proxy Manager",
    portEnv: "HOMELAB_NPM_PORT",
    defaultPort: 81,
    authHint: "Check authentication -- set HOMELAB_NPM_EMAIL and HOMELAB_NPM_PASSWORD.",
  },
  prometheus: { name: "Prometheus", portEnv: "HOMELAB_PROMETHEUS_PORT", defaultPort: 9090 },
  alertmanager: { name: "Alertmanager", portEnv: "HOMELAB_ALERTMANAGER_PORT", defaultPort: 9093 },
  uptimeKuma: { name: "Uptime Kuma", portEnv: "HOMELAB_UPTIME_KUMA_PORT", defaultPort: 3001 },
  speedtest: {
    name: "Speedtest Tracker",
    portEnv: "HOMELAB_SPEEDTEST_PORT",
    defaultPort: 8765,
    authHint: "Check HOMELAB_SPEEDTEST_TOKEN and its results:read permission.",
  },
  ntfy: { name: "Ntfy", portEnv: "HOMELAB_NTFY_PORT", defaultPort: 8080 },
} satisfies Record<string, ServiceDef>;

/** Read a HOMELAB_* setting for a node, falling back to `fallback`. */
export function setting(node: string | undefined, key: string, fallback: string): string;
export function setting(node: string | undefined, key: string): string | undefined;
export function setting(node: string | undefined, key: string, fallback?: string): string | undefined {
  return nodeSetting(node, key) ?? fallback;
}

/** Resolve and validate a service port (env override, per-node overridable). */
export function servicePort(service: ServiceDef, node?: string): number {
  const raw = nodeSetting(node, service.portEnv);
  if (raw === undefined) return service.defaultPort;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${service.portEnv} must be a port number between 1 and 65535 (got "${raw}").`);
  }
  return port;
}

/** Basic-auth flag for AdGuard Home. */
export function adguardAuth(node?: string): string {
  const user = setting(node, "HOMELAB_ADGUARD_USER", "admin");
  const password = setting(node, "HOMELAB_ADGUARD_PASSWORD", "admin");
  return `-u '${user}:${password}'`;
}

/** Bearer token (preferred) or basic-auth flag for Grafana. */
export function grafanaAuth(node?: string): string {
  const token = setting(node, "HOMELAB_GRAFANA_TOKEN");
  if (token) {
    return `-H 'Authorization: Bearer ${token}'`;
  }
  const user = setting(node, "HOMELAB_GRAFANA_USER", "admin");
  const password = setting(node, "HOMELAB_GRAFANA_PASSWORD");
  if (password) {
    return `-u '${user}:${password}'`;
  }
  return `-u 'admin:admin'`;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Exit status of the NPM script when the login response has no token. */
export const NPM_NO_TOKEN_EXIT = 65;

/**
 * Remote script that logs in to Nginx Proxy Manager and GETs `path` with
 * the token in the same SSH session, so each NPM call is one round trip.
 * curl failures keep their exit status (7, 22, 28) for curlErrorResponse.
 */
export function npmGetCommand(path: string, port: number, node?: string): string {
  const email = setting(node, "HOMELAB_NPM_EMAIL", "admin@example.com");
  const password = setting(node, "HOMELAB_NPM_PASSWORD", "changeme");
  const payload = JSON.stringify({ identity: email, secret: password });
  const base = `http://localhost:${port}/api`;
  return [
    `resp=$(curl -sf -X POST -H 'Content-Type: application/json' -d ${shellQuote(payload)} '${base}/tokens') || exit $?`,
    `token=$(printf '%s' "$resp" | sed -n 's/.*"token" *: *"\\([^"]*\\)".*/\\1/p')`,
    `if [ -z "$token" ]; then echo 'Nginx Proxy Manager login returned no token. Check HOMELAB_NPM_EMAIL and HOMELAB_NPM_PASSWORD.' >&2; exit ${NPM_NO_TOKEN_EXIT}; fi`,
    `curl -sf -H "Authorization: Bearer $token" '${base}${path}'`,
  ].join("; ");
}

/** Log in to Nginx Proxy Manager and GET an API path in one SSH round trip. */
export function npmGet(path: string, port: number, node?: string): Promise<string> {
  return execSSH(npmGetCommand(path, port, node), node);
}

export interface CurlErrorOptions {
  /** Replaces the default HTTP-error (exit 22) message. */
  httpError?: string;
}

/**
 * Map curl failures to actionable messages: exit 7 (cannot connect),
 * 22 (HTTP error), 28 (timeout), and unparseable JSON responses. Anything
 * else goes through errorResponse unchanged.
 */
export function curlErrorResponse(
  error: unknown,
  service: ServiceDef,
  port: number,
  options: CurlErrorOptions = {},
) {
  if (error instanceof CommandFailedError) {
    if (error.exitCode === 7) {
      return errorResponse(
        new Error(
          `Could not connect to ${service.name} on port ${port}. Is it running? ` +
            `Set ${service.portEnv} if using a non-default port.`,
        ),
      );
    }
    if (error.exitCode === 22) {
      return errorResponse(
        new Error(
          options.httpError ??
            `${service.name} on port ${port} returned an HTTP error.` +
              (service.authHint ? ` ${service.authHint}` : ""),
        ),
      );
    }
    if (error.exitCode === 28) {
      return errorResponse(
        new Error(`${service.name} on port ${port} did not respond in time.`),
      );
    }
  }
  if (error instanceof SyntaxError) {
    return errorResponse(
      new Error(
        `Unexpected (non-JSON) response from ${service.name} on port ${port}.` +
          (service.authHint ? ` ${service.authHint}` : ""),
      ),
    );
  }
  return errorResponse(error);
}
