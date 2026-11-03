import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/ssh-api.js", () => ({
  execSSH: vi.fn(),
  errorResponse: vi.fn((error: unknown) => ({
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : "Unknown error",
      },
    ],
    isError: true,
  })),
  checkSSHAvailable: vi.fn(),
  listNodes: vi.fn(() => [
    { name: "default", host: "raspberrypi.local" },
    { name: "nas", host: "nas.local" },
  ]),
  getNodeConfig: vi.fn(),
}));

import { execSSH, listNodes } from "../../utils/ssh-api.js";

const mockExecSSH = vi.mocked(execSSH);
const mockListNodes = vi.mocked(listNodes);

describe("integration tests (mocked SSH)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

      const { register } = await import("../healthCheck.js");
      const handler = captureHandler(register);
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

      const { register } = await import("../healthCheck.js");
      const handler = captureHandler(register);
      await handler({ node: "nas" });

      expect(mockExecSSH).toHaveBeenCalled();
      for (const call of mockExecSSH.mock.calls) {
        expect(call[1]).toBe("nas");
      }
    });

    it("builds a script that passes the command guard and covers every check", async () => {
      const { buildHealthCheckScript, parseHealthCheckOutput } = await import("../healthCheck.js");
      const { assertCommandSafe } = await vi.importActual<typeof import("../../utils/ssh-api.js")>(
        "../../utils/ssh-api.js",
      );
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

      const { register } = await import("../diagnostics.js");
      const handler = captureHandler(register);
      const result = await handler({ node: "nas" });

      const text = result.content[0].text;
      expect(text).toContain("=== OS ===");
      expect(text).toContain("Debian GNU/Linux 12");
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
      expect(mockExecSSH.mock.calls[0][1]).toBe("nas");
    });

    it("builds a script with every section that passes the command guard", async () => {
      const { buildDiagnosticsScript } = await import("../diagnostics.js");
      const { assertCommandSafe } = await vi.importActual<typeof import("../../utils/ssh-api.js")>(
        "../../utils/ssh-api.js",
      );
      const script = buildDiagnosticsScript();
      expect(() => assertCommandSafe(script)).not.toThrow();
      for (const label of ["OS", "Kernel", "Docker", "Containers", "Memory", "Disk", "Uptime", "Node.js", "Network"]) {
        expect(script).toContain(`echo '=== ${label} ==='`);
      }
      expect(script).toContain("(unavailable: ");
    });

    it("returns an error with the cause when the node is unreachable", async () => {
      mockExecSSH.mockRejectedValueOnce(new Error('Unknown node "typo"'));

      const { register } = await import("../diagnostics.js");
      const handler = captureHandler(register);
      const result = await handler({ node: "typo" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown node "typo"');
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
    });
  });

  describe("healthCheck failures", () => {
    it("stops and reports the cause when SSH connectivity fails", async () => {
      mockExecSSH.mockRejectedValueOnce(new Error("SSH authentication failed."));

      const { register } = await import("../healthCheck.js");
      const handler = captureHandler(register);
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("[FAIL] SSH connectivity: SSH authentication failed.");
      expect(mockExecSSH).toHaveBeenCalledTimes(1);
    });
  });

  describe("confirm gate tools", () => {
    it("backupRestore blocks when confirm=false", async () => {
      const { register } = await import("../backupRestore.js");
      const handler = captureHandler(register);
      const result = await handler({
        snapshot: "abc123",
        target: "/tmp/restore",
        confirm: false,
      });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("certRenew blocks when confirm=false", async () => {
      const { register } = await import("../certRenew.js");
      const handler = captureHandler(register);
      const result = await handler({ confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("nodeExec blocks when confirm=false", async () => {
      const { register } = await import("../nodeExec.js");
      const handler = captureHandler(register);
      const result = await handler({
        node: "pi5",
        command: "ls",
        confirm: false,
      });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("serviceRestart blocks when confirm=false", async () => {
      const { register } = await import("../serviceRestart.js");
      const handler = captureHandler(register);
      const result = await handler({ service: "grafana", confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("composeUp blocks when confirm=false", async () => {
      const { register } = await import("../composeUp.js");
      const handler = captureHandler(register);
      const result = await handler({ confirm: false });

      expect(result.content[0].text).toContain("cancelled");
      expect(mockExecSSH).not.toHaveBeenCalled();
    });

    it("composeDown blocks when confirm=false", async () => {
      const { register } = await import("../composeDown.js");
      const handler = captureHandler(register);
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

      const { register } = await import("../nodeList.js");
      const handler = captureHandler(register);
      const result = await handler({});

      const text = result.content[0].text;
      expect(text).toContain("default (raspberrypi.local) -- online");
      expect(text).toContain("nas (nas.local) -- offline (connection refused)");
    });

    it("returns an error when the node registry is invalid", async () => {
      mockListNodes.mockImplementationOnce(() => {
        throw new Error("HOMELAB_NODES is not valid JSON");
      });

      const { register } = await import("../nodeList.js");
      const handler = captureHandler(register);
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("HOMELAB_NODES is not valid JSON");
    });
  });

  describe("error handling", () => {
    it("piStatus returns error on SSH failure", async () => {
      mockExecSSH.mockRejectedValueOnce(new Error("Connection refused"));

      const { register } = await import("../piStatus.js");
      const handler = captureHandler(register);
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
    tool: (_name: string, _desc: string, _schema: any, handler: any) => {
      captured = handler;
    },
  };
  registerFn(fakeServer);
  if (!captured) throw new Error("Handler not captured");
  return captured;
}
