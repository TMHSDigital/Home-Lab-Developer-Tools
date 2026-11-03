import { homedir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expandHomePath, execSSH, getNodeConfig } from "../ssh-api.js";
import { SSHAuthError } from "../errors.js";

describe("expandHomePath", () => {
  it("expands a leading ~/", () => {
    expect(expandHomePath("~/.ssh/id_ed25519")).toBe(
      resolve(homedir(), ".ssh/id_ed25519"),
    );
  });

  it("expands a bare ~", () => {
    expect(expandHomePath("~")).toBe(homedir());
  });

  it("leaves absolute and relative paths alone", () => {
    expect(expandHomePath("/tmp/pi_key")).toBe("/tmp/pi_key");
    expect(expandHomePath("keys/id_ed25519")).toBe("keys/id_ed25519");
  });

  it("expands Windows-style ~\\", () => {
    expect(expandHomePath("~\\.ssh\\id_ed25519")).toBe(
      resolve(homedir(), ".ssh\\id_ed25519"),
    );
  });
});

describe("getNodeConfig tilde expansion", () => {
  afterEach(() => {
    delete process.env.HOMELAB_PI_KEY_PATH;
    delete process.env.HOMELAB_NODES;
  });

  it("expands HOMELAB_PI_KEY_PATH for the default node", () => {
    process.env.HOMELAB_PI_KEY_PATH = "~/.ssh/id_ed25519";
    expect(getNodeConfig().keyPath).toBe(resolve(homedir(), ".ssh/id_ed25519"));
  });

  it("expands keyPath entries in HOMELAB_NODES", () => {
    process.env.HOMELAB_NODES = JSON.stringify({
      nas: { host: "nas.local", user: "admin", keyPath: "~/.ssh/id_ed25519" },
    });
    expect(getNodeConfig("nas").keyPath).toBe(
      resolve(homedir(), ".ssh/id_ed25519"),
    );
  });
});

describe("execSSH missing key", () => {
  afterEach(() => {
    delete process.env.HOMELAB_PI_KEY_PATH;
    delete process.env.HOMELAB_DRY_RUN;
  });

  it("throws SSHAuthError naming the path before arming a timer", async () => {
    process.env.HOMELAB_PI_KEY_PATH = "~/definitely-missing-homelab-key";
    await expect(execSSH("echo ok")).rejects.toBeInstanceOf(SSHAuthError);
    await expect(execSSH("echo ok")).rejects.toThrow(/Cannot read SSH private key/);
  });
});
