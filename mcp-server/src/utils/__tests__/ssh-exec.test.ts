import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * A scripted stand-in for ssh2's Client. Each test sets `state.behavior` to
 * drive connect errors, exec results, exit codes and signals.
 */
interface Behavior {
  connectError?: Error & { level?: string };
  execError?: Error;
  stdout?: string[];
  stderr?: string[];
  exitCode?: number | null;
  signal?: string | null;
  hang?: boolean;
}

const state = vi.hoisted(() => ({
  behavior: {} as Behavior,
  ended: 0,
  signals: [] as string[],
}));

vi.mock("ssh2", async () => {
  const { EventEmitter } = await import("node:events");

  class FakeStream extends EventEmitter {
    stderr = new EventEmitter();
    signal(name: string) {
      state.signals.push(name);
    }
    close() {}
  }

  class Client extends EventEmitter {
    connect() {
      const b = state.behavior;
      queueMicrotask(() => {
        if (b.connectError) this.emit("error", b.connectError);
        else this.emit("ready");
      });
      return this;
    }
    exec(_cmd: string, cb: (err: Error | undefined, stream: FakeStream) => void) {
      const b = state.behavior;
      if (b.execError) {
        cb(b.execError, new FakeStream());
        return;
      }
      const stream = new FakeStream();
      cb(undefined, stream);
      if (b.hang) return;
      queueMicrotask(() => {
        for (const chunk of b.stdout ?? []) stream.emit("data", Buffer.from(chunk));
        for (const chunk of b.stderr ?? []) stream.stderr.emit("data", Buffer.from(chunk));
        stream.emit("close", b.exitCode === undefined ? 0 : b.exitCode, b.signal ?? null);
      });
    }
    end() {
      state.ended++;
    }
  }
  return { Client };
});

import { execSSH, errorResponse } from "../ssh-api.js";
import {
  SSHAuthError,
  SSHConnectionError,
  SSHTimeoutError,
  CommandFailedError,
  SSHError,
} from "../errors.js";

beforeEach(() => {
  state.behavior = {};
  state.ended = 0;
  state.signals.length = 0;
  delete process.env.HOMELAB_DRY_RUN;
  delete process.env.HOMELAB_PI_KEY_PATH;
  delete process.env.HOMELAB_NODES;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("execSSH with a mocked SSH client", () => {
  it("resolves trimmed stdout on exit 0", async () => {
    state.behavior = { stdout: ["hello ", "world\n"], exitCode: 0 };
    await expect(execSSH("echo hi")).resolves.toBe("hello world");
    expect(state.ended).toBeGreaterThan(0);
  });

  it("rejects with CommandFailedError carrying stderr on non-zero exit", async () => {
    state.behavior = { stderr: ["boom\n"], exitCode: 3 };
    const err = await execSSH("false").catch((e) => e);
    expect(err).toBeInstanceOf(CommandFailedError);
    expect(err.exitCode).toBe(3);
    expect(err.message).toBe("boom");
  });

  it("rejects when the remote command is killed by a signal", async () => {
    state.behavior = { stdout: ["partial"], exitCode: null, signal: "KILL" };
    const err = await execSSH("big-job").catch((e) => e);
    expect(err).toBeInstanceOf(CommandFailedError);
    expect(err.message).toContain("terminated by signal KILL");
  });

  it("maps exec channel errors to SSHError", async () => {
    state.behavior = { execError: new Error("channel open failure") };
    const err = await execSSH("echo ok").catch((e) => e);
    expect(err).toBeInstanceOf(SSHError);
    expect(err.message).toBe("channel open failure");
  });

  it("maps authentication failures to SSHAuthError", async () => {
    state.behavior = { connectError: new Error("All configured authentication methods failed") };
    await expect(execSSH("echo ok")).rejects.toBeInstanceOf(SSHAuthError);
  });

  it.each(["connect ECONNREFUSED", "getaddrinfo ENOTFOUND pi", "connect ETIMEDOUT"])(
    "maps %j to SSHConnectionError",
    async (message) => {
      state.behavior = { connectError: new Error(message) };
      await expect(execSSH("echo ok")).rejects.toBeInstanceOf(SSHConnectionError);
    },
  );

  it("maps other client errors to SSHError", async () => {
    state.behavior = { connectError: new Error("Handshake failed") };
    const err = await execSSH("echo ok").catch((e) => e);
    expect(err).toBeInstanceOf(SSHError);
    expect(err.message).toBe("Handshake failed");
  });

  it("times out, signals the remote command and reports it may still be running", async () => {
    vi.useFakeTimers();
    state.behavior = { hang: true };
    const pending = execSSH("sleep 999", undefined, { timeoutMs: 5_000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5_001);
    const err = await pending;
    expect(err).toBeInstanceOf(SSHTimeoutError);
    expect(err.message).toContain("may still be running");
    expect(state.signals).toContain("TERM");
    expect(state.ended).toBeGreaterThan(0);
  });

  it("rejects in dry-run mode for an unknown node", async () => {
    process.env.HOMELAB_DRY_RUN = "true";
    await expect(execSSH("echo ok", "typo")).rejects.toThrow(/Unknown node "typo"/);
  });
});

describe("errorResponse", () => {
  const text = (r: ReturnType<typeof errorResponse>) => r.content[0].text;

  it("adds a suggestion for each SSH error class", () => {
    expect(text(errorResponse(new SSHConnectionError("pi")))).toContain("Suggestion: Check that the Pi is powered on");
    expect(text(errorResponse(new SSHAuthError()))).toContain("Suggestion: Verify HOMELAB_PI_KEY_PATH");
    expect(text(errorResponse(new SSHTimeoutError(1000)))).toContain("Suggestion: The Pi may be under heavy load");
    expect(text(errorResponse(new CommandFailedError("ls", 2, "nope")))).toContain("Suggestion: The command failed");
  });

  it("handles plain errors and unknown values", () => {
    expect(text(errorResponse(new Error("plain")))).toBe("plain");
    expect(text(errorResponse("weird"))).toBe("An unknown error occurred.");
    expect(errorResponse("weird").isError).toBe(true);
  });
});
