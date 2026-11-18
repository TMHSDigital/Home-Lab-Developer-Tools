import { describe, it, expect, afterEach } from "vitest";
import { resticCommand, resticErrorResponse } from "../restic.js";
import { CommandFailedError } from "../errors.js";
import { assertCommandSafe } from "../ssh-api.js";

const KEYS = ["HOMELAB_BACKUP_REPO", "HOMELAB_RESTIC_ENV_FILE", "HOMELAB_RESTIC_PASSWORD_FILE"];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("resticCommand", () => {
  it("sources /etc/restic-env by default so sudo keeps the repository password", () => {
    const cmd = resticCommand("snapshots --json");
    expect(cmd).toBe(
      `sudo sh -c 'if [ -f "$0" ]; then set -a; . "$0"; set +a; fi; exec restic "$@"' ` +
        `'/etc/restic-env' -r '/mnt/backup/restic' snapshots --json`,
    );
    expect(() => assertCommandSafe(cmd)).not.toThrow();
  });

  it("uses a configured env file and password file", () => {
    process.env.HOMELAB_RESTIC_ENV_FILE = "/etc/backup/restic.env";
    process.env.HOMELAB_RESTIC_PASSWORD_FILE = "/root/.restic-pass";
    const cmd = resticCommand("snapshots");
    expect(cmd).toContain(`'/etc/backup/restic.env' -r '/mnt/backup/restic' --password-file '/root/.restic-pass' snapshots`);
  });

  it("runs restic directly when the env file is disabled", () => {
    process.env.HOMELAB_RESTIC_ENV_FILE = "none";
    process.env.HOMELAB_RESTIC_PASSWORD_FILE = "/root/.restic-pass";
    expect(resticCommand("snapshots")).toBe(
      "sudo restic -r '/mnt/backup/restic' --password-file '/root/.restic-pass' snapshots",
    );
  });

  it("rejects relative or unusual paths", () => {
    process.env.HOMELAB_RESTIC_PASSWORD_FILE = "pass;id";
    expect(() => resticCommand("snapshots")).toThrow(/HOMELAB_RESTIC_PASSWORD_FILE/);
  });
});

describe("resticErrorResponse", () => {
  it.each([
    "Fatal: an empty password is not allowed by default",
    "Resolving password failed: Fatal: cannot read password",
    "Fatal: wrong password or no key found",
  ])("names the password settings for %j", (message) => {
    const result = resticErrorResponse(new CommandFailedError("restic", 1, message), "/mnt/backup/restic");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HOMELAB_RESTIC_PASSWORD_FILE");
    expect(result.content[0].text).toContain(message);
  });
});
