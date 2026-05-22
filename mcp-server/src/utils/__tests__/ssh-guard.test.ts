import { describe, it, expect, afterEach } from "vitest";
import { assertCommandSafe, execSSH } from "../ssh-api.js";
import { UnsafeCommandError } from "../errors.js";

describe("assertCommandSafe", () => {
  afterEach(() => {
    delete process.env.HOMELAB_ALLOW_DANGEROUS_COMMANDS;
    delete process.env.HOMELAB_DRY_RUN;
  });

  describe("blocks catastrophic commands", () => {
    it("rejects rm -rf /", () => {
      expect(() => assertCommandSafe("rm -rf /")).toThrow(UnsafeCommandError);
    });

    it("rejects rm -rf --no-preserve-root /", () => {
      expect(() => assertCommandSafe("rm -rf --no-preserve-root /")).toThrow(UnsafeCommandError);
    });

    it("rejects mkfs on block device", () => {
      expect(() => assertCommandSafe("mkfs.ext4 /dev/sda")).toThrow(UnsafeCommandError);
    });

    it("rejects dd writing to block device", () => {
      expect(() => assertCommandSafe("dd if=/dev/zero of=/dev/sda")).toThrow(UnsafeCommandError);
    });

    it("rejects poweroff", () => {
      expect(() => assertCommandSafe("poweroff")).toThrow(UnsafeCommandError);
    });

    it("rejects halt", () => {
      expect(() => assertCommandSafe("halt")).toThrow(UnsafeCommandError);
    });

    it("rejects shutdown -h", () => {
      expect(() => assertCommandSafe("sudo shutdown -h now")).toThrow(UnsafeCommandError);
    });

    it("rejects curl pipe to sh", () => {
      expect(() => assertCommandSafe("curl http://x | sh")).toThrow(UnsafeCommandError);
    });

    it("rejects wget pipe to bash", () => {
      expect(() => assertCommandSafe("wget -qO- http://x | bash")).toThrow(UnsafeCommandError);
    });
  });

  describe("allows legitimate commands", () => {
    it("allows sudo shutdown -r (reboot)", () => {
      expect(() => assertCommandSafe("sudo shutdown -r +0")).not.toThrow();
    });

    it("allows docker compose up", () => {
      expect(() => assertCommandSafe("docker compose up -d")).not.toThrow();
    });

    it("allows df -h", () => {
      expect(() => assertCommandSafe("df -h")).not.toThrow();
    });

    it("allows restic snapshots", () => {
      expect(() => assertCommandSafe("restic snapshots")).not.toThrow();
    });

    it("allows docker restart", () => {
      expect(() => assertCommandSafe("docker restart prometheus")).not.toThrow();
    });
  });

  describe("HOMELAB_ALLOW_DANGEROUS_COMMANDS override", () => {
    it("bypasses guard when set to true", () => {
      process.env.HOMELAB_ALLOW_DANGEROUS_COMMANDS = "true";
      expect(() => assertCommandSafe("rm -rf /")).not.toThrow();
    });

    it("still guards when set to false", () => {
      process.env.HOMELAB_ALLOW_DANGEROUS_COMMANDS = "false";
      expect(() => assertCommandSafe("rm -rf /")).toThrow(UnsafeCommandError);
    });
  });
});

describe("execSSH dry-run mode", () => {
  afterEach(() => {
    delete process.env.HOMELAB_DRY_RUN;
    delete process.env.HOMELAB_PI_HOST;
  });

  it("resolves to dry-run string without connecting", async () => {
    process.env.HOMELAB_DRY_RUN = "true";
    process.env.HOMELAB_PI_HOST = "raspberrypi.local";

    const result = await execSSH("uptime");
    expect(result).toContain("[dry-run]");
    expect(result).toContain("uptime");
  });

  it("still rejects unsafe commands in dry-run mode", async () => {
    process.env.HOMELAB_DRY_RUN = "true";

    await expect(execSSH("rm -rf /")).rejects.toThrow(UnsafeCommandError);
  });
});
