import { describe, it, expect, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { expandHome, loadPrivateKey, execSSH, TailBuffer, isDryRun } from "../ssh-api.js";
import { SSHAuthError } from "../errors.js";

const ENV_KEYS = [
  "HOMELAB_PI_HOST",
  "HOMELAB_PI_USER",
  "HOMELAB_PI_KEY_PATH",
  "HOMELAB_NODES",
  "HOMELAB_DRY_RUN",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("expandHome", () => {
  it("expands a bare ~", () => {
    expect(expandHome("~")).toBe(homedir());
  });

  it("expands ~/ paths", () => {
    expect(expandHome("~/.ssh/id_ed25519")).toBe(join(homedir(), ".ssh/id_ed25519"));
  });

  it("expands ~\\ paths (Windows style)", () => {
    expect(expandHome("~\\.ssh\\id_ed25519")).toBe(join(homedir(), ".ssh\\id_ed25519"));
  });

  it("leaves absolute and relative paths unchanged", () => {
    expect(expandHome("/etc/ssh/key")).toBe("/etc/ssh/key");
    expect(expandHome("keys/id")).toBe("keys/id");
    expect(expandHome("~user/key")).toBe("~user/key");
  });
});

describe("loadPrivateKey", () => {
  it("returns undefined when no key path is set", () => {
    expect(loadPrivateKey("")).toBeUndefined();
  });

  it("throws SSHAuthError naming the resolved path when the file is missing", () => {
    const missing = "~/.ssh/definitely-missing-homelab-test-key";
    expect(() => loadPrivateKey(missing)).toThrow(SSHAuthError);
    expect(() => loadPrivateKey(missing)).toThrow(join(homedir(), ".ssh/definitely-missing-homelab-test-key"));
  });
});

describe("TailBuffer", () => {
  it("returns all output when under the cap", () => {
    const b = new TailBuffer(100);
    b.push(Buffer.from("hello "));
    b.push(Buffer.from("world"));
    expect(b.truncated).toBe(false);
    expect(b.toString()).toBe("hello world");
  });

  it("keeps only the tail and marks truncation when over the cap", () => {
    const b = new TailBuffer(5);
    b.push(Buffer.from("abcdef"));
    b.push(Buffer.from("ghij"));
    expect(b.truncated).toBe(true);
    const text = b.toString();
    expect(text).toContain("[output truncated: showing last 5 of 10 bytes]");
    expect(text.endsWith("fghij")).toBe(true);
  });

  it("decodes multibyte characters split across chunks", () => {
    const bytes = Buffer.from("temp 45°C ✓", "utf8");
    const b = new TailBuffer(1024);
    for (const byte of bytes) b.push(Buffer.from([byte]));
    expect(b.toString()).toBe("temp 45°C ✓");
  });

  it("does not start truncated output with a broken character", () => {
    const b = new TailBuffer(4);
    b.push(Buffer.from("a✓✓", "utf8")); // 1 + 3 + 3 bytes
    const body = b.toString().split("\n")[1];
    expect(body).not.toContain("�");
    expect(body).toBe("✓");
  });
});

describe("isDryRun", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["1", true],
    ["yes", true],
    ["on", true],
    ["false", false],
    ["0", false],
    ["no", false],
    ["", false],
  ])("HOMELAB_DRY_RUN=%j -> %s", (value, expected) => {
    process.env.HOMELAB_DRY_RUN = value;
    expect(isDryRun()).toBe(expected);
  });

  it("is false when unset", () => {
    delete process.env.HOMELAB_DRY_RUN;
    expect(isDryRun()).toBe(false);
  });
});

describe("execSSH key handling", () => {
  it("rejects quickly with SSHAuthError when the key file is missing", async () => {
    process.env.HOMELAB_PI_KEY_PATH = "~/.ssh/definitely-missing-homelab-test-key";
    const start = Date.now();
    await expect(execSSH("echo ok")).rejects.toBeInstanceOf(SSHAuthError);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
