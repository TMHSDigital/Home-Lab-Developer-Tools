import { describe, it, expect, vi } from "vitest";

vi.mock("../../utils/ssh-api.js", async (importOriginal) => {
  const { mockSSHModule } = await import("./helpers/mock-ssh.js");
  return mockSSHModule(await importOriginal<typeof import("../../utils/ssh-api.js")>());
});
import { useSSHMock } from "./helpers/mock-ssh.js";

import { execSSH } from "../../utils/ssh-api.js";
import { CommandFailedError } from "../../utils/errors.js";

import { register as healthCheck, buildHealthCheckScript, parseHealthCheckOutput } from "../healthCheck.js";
import { register as diagnostics, buildDiagnosticsScript } from "../diagnostics.js";
import { register as backupRun } from "../backupRun.js";
import { register as backupStatus } from "../backupStatus.js";
import { register as backupList } from "../backupList.js";
import { register as sshTest } from "../sshTest.js";
import { register as backupRestore } from "../backupRestore.js";
import { register as certRenew } from "../certRenew.js";
import { register as nodeExec } from "../nodeExec.js";
import { register as serviceRestart } from "../serviceRestart.js";
import { register as composeUp } from "../composeUp.js";
import { register as aptUpdate } from "../aptUpdate.js";
import { register as composeDown } from "../composeDown.js";
import { register as nodeList } from "../nodeList.js";
import { register as piStatus } from "../piStatus.js";

// Load the real guard during collection, outside individual test timeouts.
const { assertCommandSafe } = await vi.importActual<typeof import("../../utils/ssh-api.js")>(
  "../../utils/ssh-api.js",
);

const mockExecSSH = vi.mocked(execSSH);
useSSHMock(mockExecSSH, {
  nas: { host: "nas.local", user: "admin", port: 2222, env: { HOMELAB_BACKUP_REPO: "/srv/restic" } },
});

describe("integration tests (mocked SSH)", () => {
  describe("healthCheck", () => {
    it("returns pass/fail checklist from a single round trip", async () => {
      mockExecSSH.mockResolvedValueOnce(
        [
          "@@CHECK|pass|Docker|Docker version 24.0.7",
          "@@CHECK|pass|Docker Compose|Docker Compose version v2.23.0",
          "@@CHECK|pass|curl|/usr/bin/curl",
          "@@CHECK|pass|restic|/usr/bin/restic",
          "@@CHECK|fail|certbot|",
          "@@CHECK|pass|systemd|systemd 252 (252.22-1)",
        ].join("\n"),
      );

      const handler = captureHandler(healthCheck);
      const result = await handler({});

      const text = result.content[0].text;
      expect(text).toContain("[PASS] SSH connectivity");
      expect(text).toContain("[PASS] Docker: Docker version 24.0.7");
      expect(text).toContain("[FAIL] certbot: not available");
      expect(text).toContain("6/7 checks passed");
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
    });

    it("passes node parameter to execSSH", async () => {
      mockExecSSH.mockResolvedValue("@@CHECK|pass|Docker|x");

      const handler = captureHandler(healthCheck);
      await handler({ node: "nas" });

      expect(mockExecSSH).toHaveBeenCalled();
      for (const call of mockExecSSH.mock.calls) {
        expect(call[1]).toBe("nas");
      }
    });

    it("builds a script that passes the command guard and covers every check", async () => {
      const script = buildHealthCheckScript();
      expect(() => assertCommandSafe(script)).not.toThrow();
      for (const name of ["Docker", "Docker Compose", "curl", "restic", "certbot", "systemd"]) {
        expect(script).toContain(`'${name}'`);
      }
      expect(parseHealthCheckOutput("noise\n@@CHECK|pass|curl|a|b")).toEqual([
        { name: "curl", status: "pass", detail: "a|b" },
      ]);
    });
  });

  describe("diagnostics", () => {
    it("returns the bundle from a single round trip", async () => {
      mockExecSSH.mockResolvedValueOnce("=== OS ===\nDebian GNU/Linux 12\n\n=== Kernel ===\nLinux");

      const handler = captureHandler(diagnostics);
      const result = await handler({ node: "nas" });

      const text = result.content[0].text;
      expect(text).toContain("=== OS ===");
      expect(text).toContain("Debian GNU/Linux 12");
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
      expect(mockExecSSH.mock.calls[0][1]).toBe("nas");
    });

    it("builds a script with every section that passes the command guard", async () => {
      const script = buildDiagnosticsScript();
      expect(() => assertCommandSafe(script)).not.toThrow();
      for (const label of ["OS", "Kernel", "Docker", "Containers", "Memory", "Disk", "Uptime", "Node.js", "Network"]) {
        expect(script).toContain(`echo '=== ${label} ==='`);
      }
      expect(script).toContain("(unavailable: ");
    });

    it("returns an error with the cause when the node is unreachable", async () => {
      mockExecSSH.mockRejectedValueOnce(new Error('Unknown node "typo"'));

      const handler = captureHandler(diagnostics);
      const result = await handler({ node: "typo" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown node "typo"');
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
    });
  });

  describe("backup error reporting", () => {
    it("backupRun returns isError when the backup script fails", async () => {
      mockExecSSH.mockRejectedValueOnce(
        new CommandFailedError("backup", 1, "Fatal: unable to create lock in backend"),
      );

      const handler = captureHandler(backupRun);
      const result = await handler({ confirm: true });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("unable to create lock");
      const cmd = mockExecSSH.mock.calls[0][0] as string;
      expect(cmd).toContain("sudo test -x '/opt/backup/backup.sh'");
      expect(cmd).not.toContain("|| echo");
    });

    it("backupStatus reports a missing repo as an error", async () => {
      mockExecSSH.mockRejectedValueOnce(
        new CommandFailedError(
          "restic",
          1,
          "Fatal: unable to open config file: stat /mnt/backup/restic/config: no such file or directory\nIs there a repository at the following location?",
        ),
      );

      const handler = captureHandler(backupStatus);
      const result = await handler({ count: 5 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No restic repository found at /mnt/backup/restic");
    });

    it("backupList surfaces other restic errors unchanged", async () => {
      mockExecSSH.mockRejectedValueOnce(
        new CommandFailedError("restic", 1, "Fatal: wrong password or no key found"),
      );

      const handler = captureHandler(backupList);
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("wrong password");
      expect(mockExecSSH.mock.calls[0][0]).not.toContain("2>/dev/null");
    });
  });

  describe("per-node settings", () => {
    it("sshTest reports the targeted node's user and host", async () => {
      mockExecSSH.mockResolvedValueOnce("ok\nnas\nup 3 days");

      const handler = captureHandler(sshTest);
      const result = await handler({ node: "nas" });

      expect(result.content[0].text).toContain("SSH connection to admin@nas.local:2222: OK");
      expect(mockExecSSH.mock.calls[0][1]).toBe("nas");
    });

    it("backup tools use the node's HOMELAB_BACKUP_REPO override", async () => {
      mockExecSSH.mockResolvedValue("[]");

      const handler = captureHandler(backupList);
      await handler({ node: "nas" });
      await handler({});

      expect(mockExecSSH.mock.calls[0][0]).toContain("-r '/srv/restic' ");
      expect(mockExecSSH.mock.calls[1][0]).toContain("-r '/mnt/backup/restic' ");
    });
  });

  describe("healthCheck failures", () => {
    it("stops and reports the cause when SSH connectivity fails", async () => {
      mockExecSSH.mockRejectedValueOnce(new Error("SSH authentication failed."));

      const handler = captureHandler(healthCheck);
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("[FAIL] SSH connectivity: SSH authentication failed.");
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
    });
  });

  describe("confirm gate tools", () => {
    it("backupRestore blocks when confirm=false", async () => {
      const handler = captureHandler(backupRestore);
      const result = await handler({
        snapshot: "abc123",
        target: "/tmp/restore",
        confirm: false,
      });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("certRenew blocks when confirm=false", async () => {
      const handler = captureHandler(certRenew);
      const result = await handler({ confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("nodeExec blocks when confirm=false", async () => {
      const handler = captureHandler(nodeExec);
      const result = await handler({
        node: "pi5",
        command: "ls",
        confirm: false,
      });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("serviceRestart blocks when confirm=false", async () => {
      const handler = captureHandler(serviceRestart);
      const result = await handler({ service: "grafana", confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("composeUp blocks when confirm=false", async () => {
      const handler = captureHandler(composeUp);
      const result = await handler({ confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("aptUpdate upgrade blocks without confirm=true", async () => {
      const handler = captureHandler(aptUpdate);
      for (const args of [{ upgrade: true }, { upgrade: true, confirm: false }]) {
        const result = await handler(args);
        expect(result.content[0].text).toContain("cancelled");
      }
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("aptUpdate runs upgrade with confirm=true and lists without it", async () => {
      mockExecSSH.mockResolvedValue("ok");
      const handler = captureHandler(aptUpdate);

      await handler({ upgrade: false });
      expect(mockExecSSH.mock.calls[0][0]).not.toContain("apt-get upgrade");

      await handler({ upgrade: true, confirm: true });
      expect(mockExecSSH.mock.calls[1][0]).toContain("apt-get upgrade -y");
    });

    it("composeDown blocks when confirm=false", async () => {
      const handler = captureHandler(composeDown);
      const result = await handler({ confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });
  });

  describe("nodeList", () => {
    it("reports online/offline nodes", async () => {
      mockExecSSH
        .mockResolvedValueOnce("ok")
        .mockRejectedValueOnce(new Error("connection refused"));

      const handler = captureHandler(nodeList);
      const result = await handler({});

      const text = result.content[0].text;
      expect(text).toContain("default (raspberrypi.local) -- online");
      expect(text).toContain("nas (nas.local:2222) -- offline (connection refused)");
    });

    it("returns an error when the node registry is invalid", async () => {
      process.env.HOMELAB_NODES = "not JSON";

      const handler = captureHandler(nodeList);
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("HOMELAB_NODES is not valid JSON");
    });
  });

  describe("error handling", () => {
    it("piStatus returns error on SSH failure", async () => {
      mockExecSSH.mockRejectedValueOnce(new Error("Connection refused"));

      const handler = captureHandler(piStatus);
      const result = await handler({});

      expect(result.isError).toBe(true);
    });
  });
});

function captureHandler(
  registerFn: (server: any) => void,
): (args: any) => Promise<any> {
  let captured: ((args: any) => Promise<any>) | null = null;
  const fakeServer = {
    registerTool: (_name: string, _config: any, handler: any) => {
      captured = handler;
    },
  };
  registerFn(fakeServer);
  if (!captured) throw new Error("Handler not captured");
  return captured;
}
