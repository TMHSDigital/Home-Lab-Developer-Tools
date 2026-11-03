import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Client } from "ssh2";
import {
  SSHError,
  SSHConnectionError,
  SSHAuthError,
  SSHTimeoutError,
  CommandFailedError,
  UnsafeCommandError,
} from "./errors.js";

const DANGEROUS_PATTERNS: Array<[RegExp, string]> = [
  [/\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(--no-preserve-root\s+)?\/(\s|\*|$)/i, "rm -rf /"],
  [/\bmkfs(\.\w+)?\s+\/dev\//i, "mkfs on block device"],
  [/\bdd\b[^|;&]*\bof=\/dev\//i, "dd to block device"],
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, "fork bomb"],
  [/\bchmod\s+-R\s+777\s+\//, "chmod -R 777 /"],
  [/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash)\b/i, "curl|sh pipe"],
  [/\b(shutdown\s+-h|halt|poweroff)\b/i, "host power off"],
];

export function assertCommandSafe(command: string): void {
  if (process.env.HOMELAB_ALLOW_DANGEROUS_COMMANDS === "true") return;
  for (const [re, label] of DANGEROUS_PATTERNS) {
    if (re.test(command)) throw new UnsafeCommandError(command, label);
  }
}

const CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_EXEC_TIMEOUT_MS = 30_000;

/** Timeout budgets for tools that run long remote operations. */
export const TIMEOUTS = {
  /** apt upgrade, compose pull, image scans, volume backups. */
  long: 30 * 60_000,
  /** restic backup/restore runs. */
  backup: 60 * 60_000,
  /** compose up/down, apt update, cert renewal, disk walks, log searches. */
  medium: 5 * 60_000,
} as const;

export interface ExecOptions {
  /** Overall timeout (connect + command) in milliseconds. */
  timeoutMs?: number;
}

/**
 * Default exec timeout. HOMELAB_SSH_TIMEOUT_MS overrides the 30s default for
 * tools that do not set their own budget.
 */
export function defaultExecTimeoutMs(): number {
  const raw = process.env.HOMELAB_SSH_TIMEOUT_MS;
  if (!raw) return DEFAULT_EXEC_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXEC_TIMEOUT_MS;
}

export interface NodeConfig {
  host: string;
  username: string;
  keyPath: string;
  /** Per-node overrides for HOMELAB_* settings (compose dir, backup repo, ports, ...). */
  env: Record<string, string>;
}

function getDefaultConfig(): NodeConfig {
  return {
    host: process.env.HOMELAB_PI_HOST || "raspberrypi.local",
    username: process.env.HOMELAB_PI_USER || "pi",
    keyPath: process.env.HOMELAB_PI_KEY_PATH || "",
    env: {},
  };
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const SETTING_KEY_RE = /^HOMELAB_[A-Z0-9_]+$/;

function parseNodeEnv(name: string, value: unknown): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SSHError(`HOMELAB_NODES entry "${name}": "env" must be an object of HOMELAB_* settings.`);
  }
  const env: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (!SETTING_KEY_RE.test(key)) {
      throw new SSHError(`HOMELAB_NODES entry "${name}": env key "${key}" must look like HOMELAB_*.`);
    }
    if (typeof v !== "string" && typeof v !== "number") {
      throw new SSHError(`HOMELAB_NODES entry "${name}": env value for ${key} must be a string or number.`);
    }
    env[key] = String(v);
  }
  return env;
}

/**
 * Resolve a HOMELAB_* setting for a node: the node's `env` override from
 * HOMELAB_NODES first, then the process environment.
 */
export function nodeSetting(node: string | undefined, key: string): string | undefined {
  const override = getNodeConfig(node).env[key];
  if (override !== undefined && override !== "") return override;
  const value = process.env[key];
  return value === undefined || value === "" ? undefined : value;
}

/**
 * Parse HOMELAB_NODES. Invalid JSON or entries without a host raise an
 * SSHError naming the problem instead of silently dropping every node.
 */
function getNodesRegistry(): Map<string, NodeConfig> {
  const registry = new Map<string, NodeConfig>();
  const raw = process.env.HOMELAB_NODES;
  if (!raw || !raw.trim()) return registry;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new SSHError(`HOMELAB_NODES is not valid JSON (${reason}).`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SSHError(
      'HOMELAB_NODES must be a JSON object mapping node names to {"host", "user", "keyPath", "env"}.',
    );
  }

  for (const [name, cfg] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
      throw new SSHError(`HOMELAB_NODES entry "${name}" must be an object.`);
    }
    const c = cfg as Record<string, unknown>;
    const host = optionalString(c.host).trim();
    if (!host) {
      throw new SSHError(`HOMELAB_NODES entry "${name}" is missing "host".`);
    }
    registry.set(name, {
      host,
      username: optionalString(c.user) || optionalString(c.username) || "pi",
      keyPath: optionalString(c.keyPath),
      env: parseNodeEnv(name, c.env),
    });
  }
  return registry;
}

export function getNodeConfig(node?: string): NodeConfig {
  if (!node) return getDefaultConfig();

  const registry = getNodesRegistry();
  const cfg = registry.get(node);
  if (cfg) return cfg;

  if (node === "default") return getDefaultConfig();

  throw new SSHError(
    `Unknown node "${node}". Available nodes: ${listNodes().map((n) => n.name).join(", ")}. ` +
      "Add nodes via HOMELAB_NODES.",
  );
}

export function listNodes(): { name: string; host: string }[] {
  const defaultCfg = getDefaultConfig();
  const nodes: { name: string; host: string }[] = [
    { name: "default", host: defaultCfg.host },
  ];

  const registry = getNodesRegistry();
  for (const [name, cfg] of registry) {
    nodes.push({ name, host: cfg.host });
  }

  return nodes;
}

/**
 * Expand a leading "~" to the user's home directory. MCP clients and CI
 * runners pass env values literally (no shell), so "~/.ssh/id_ed25519"
 * would otherwise be treated as a relative path.
 */
export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/** Read the private key, mapping file errors to a clear SSHAuthError. */
export function loadPrivateKey(keyPath: string): Buffer | undefined {
  if (!keyPath) return undefined;
  const resolved = expandHome(keyPath);
  try {
    return readFileSync(resolved);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new SSHAuthError(
      `Cannot read SSH private key at "${resolved}" (${reason}). ` +
        "Check HOMELAB_PI_KEY_PATH (or keyPath in HOMELAB_NODES).",
    );
  }
}

/** HOMELAB_DRY_RUN is enabled by "true", "1", "yes" or "on" (case-insensitive). */
export function isDryRun(): boolean {
  const raw = (process.env.HOMELAB_DRY_RUN ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

/** Max bytes of stdout/stderr kept per command (HOMELAB_MAX_OUTPUT_BYTES, default 1 MiB). */
export function maxOutputBytes(): number {
  const n = Number(process.env.HOMELAB_MAX_OUTPUT_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_OUTPUT_BYTES;
}

/**
 * Collects raw output chunks and keeps only the last `maxBytes` bytes.
 * Decoding happens once at the end so multibyte UTF-8 characters split
 * across chunks are not corrupted.
 */
export class TailBuffer {
  private chunks: Buffer[] = [];
  private size = 0;
  private total = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
    this.total += chunk.length;
    while (this.size > this.maxBytes && this.chunks.length > 0) {
      const excess = this.size - this.maxBytes;
      const first = this.chunks[0];
      if (first.length <= excess) {
        this.chunks.shift();
        this.size -= first.length;
      } else {
        this.chunks[0] = first.subarray(excess);
        this.size -= excess;
      }
    }
  }

  get truncated(): boolean {
    return this.total > this.size;
  }

  toString(): string {
    let buf = Buffer.concat(this.chunks);
    if (this.truncated) {
      // Skip UTF-8 continuation bytes left over from the cut.
      let start = 0;
      while (start < buf.length && start < 4 && (buf[start] & 0xc0) === 0x80) start++;
      buf = buf.subarray(start);
      return `[output truncated: showing last ${buf.length} of ${this.total} bytes]\n` + buf.toString("utf8");
    }
    return buf.toString("utf8");
  }
}

export async function execSSH(
  command: string,
  node?: string,
  options: ExecOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? defaultExecTimeoutMs();
  assertCommandSafe(command);

  if (isDryRun()) {
    const cfg = getNodeConfig(node);
    return `[dry-run] would execute on ${cfg.host}: ${command}`;
  }

  const { host, username, keyPath } = getNodeConfig(node);
  // Read the key before arming the timer so a bad path fails fast and
  // does not leave a pending timeout behind.
  const privateKey = loadPrivateKey(keyPath);

  return new Promise((resolve, reject) => {
    const conn = new Client();
    const maxBytes = maxOutputBytes();
    const stdout = new TailBuffer(maxBytes);
    const stderr = new TailBuffer(maxBytes);
    let timedOut = false;
    let started = false;
    let activeStream: { signal?: (name: string) => unknown; close?: () => unknown } | null = null;

    const timer = setTimeout(() => {
      timedOut = true;
      if (activeStream) {
        // Best effort: ask the remote side to terminate the command before
        // dropping the connection. Not every SSH server honors signals.
        try {
          activeStream.signal?.("TERM");
        } catch {
          // ignore
        }
        try {
          activeStream.close?.();
        } catch {
          // ignore
        }
      }
      conn.end();
      reject(new SSHTimeoutError(timeoutMs, started));
    }, timeoutMs);

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(new SSHError(err.message, command));
          }
          started = true;
          activeStream = stream;

          stream
            .on("close", (code: number | null, signal?: string | null) => {
              clearTimeout(timer);
              conn.end();
              if (timedOut) return;

              if (signal) {
                // Killed by a signal (for example the OOM killer): partial
                // output must not be reported as success.
                reject(
                  new CommandFailedError(
                    command,
                    -1,
                    `${stderr.toString().trim()}\nRemote command terminated by signal ${signal}`.trim(),
                  ),
                );
              } else if (code !== 0 && code !== null && code !== undefined) {
                reject(new CommandFailedError(command, code, stderr.toString()));
              } else {
                resolve(stdout.toString().trim());
              }
            })
            .on("data", (data: Buffer) => {
              stdout.push(data);
            })
            .stderr.on("data", (data: Buffer) => {
              stderr.push(data);
            });
        });
      })
      .on("error", (err: Error & { level?: string }) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (
          err.message.includes("authentication") ||
          err.message.includes("All configured authentication methods failed")
        ) {
          reject(new SSHAuthError());
        } else if (
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("ENOTFOUND") ||
          err.message.includes("ETIMEDOUT") ||
          err.level === "client-timeout"
        ) {
          reject(new SSHConnectionError(host));
        } else {
          reject(new SSHError(err.message));
        }
      })
      .connect({
        host,
        port: 22,
        username,
        privateKey,
        agent: process.env.SSH_AUTH_SOCK,
        readyTimeout: CONNECT_TIMEOUT_MS,
      });
  });
}

export async function checkSSHAvailable(): Promise<void> {
  try {
    await execSSH("echo ok");
  } catch (error) {
    throw error;
  }
}

export function errorResponse(error: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  if (error instanceof SSHError) {
    const parts: string[] = [`[${error.name}] ${error.message}`];

    if (error.command) {
      parts.push(`Command: ${error.command}`);
    }

    const suggestion = getErrorSuggestion(error);
    if (suggestion) {
      parts.push(`Suggestion: ${suggestion}`);
    }

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
      isError: true,
    };
  }
  if (error instanceof Error) {
    return {
      content: [{ type: "text" as const, text: error.message }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: "An unknown error occurred." }],
    isError: true,
  };
}

function getErrorSuggestion(error: SSHError): string | null {
  if (error instanceof SSHConnectionError) {
    return "Check that the Pi is powered on and reachable. Verify HOMELAB_PI_HOST is correct.";
  }
  if (error instanceof SSHAuthError) {
    return "Verify HOMELAB_PI_KEY_PATH points to a valid private key and HOMELAB_PI_USER is correct.";
  }
  if (error instanceof SSHTimeoutError) {
    return "The Pi may be under heavy load or unreachable. Try again or check network connectivity.";
  }
  if (error instanceof CommandFailedError) {
    return "The command failed on the Pi. Check the error output above for details.";
  }
  return null;
}
