import { describe, it, expect, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { expandHome, loadPrivateKey, execSSH } from "../ssh-api.js";
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

describe("execSSH key handling", () => {
  it("rejects quickly with SSHAuthError when the key file is missing", async () => {
    process.env.HOMELAB_PI_KEY_PATH = "~/.ssh/definitely-missing-homelab-test-key";
    const start = Date.now();
    await expect(execSSH("echo ok")).rejects.toBeInstanceOf(SSHAuthError);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
