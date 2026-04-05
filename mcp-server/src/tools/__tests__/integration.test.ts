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
    { name: "default", host: "raspi5.local" },
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
    it("returns pass/fail checklist", async () => {
      mockExecSSH
        .mockResolvedValueOnce("ok")
        .mockResolvedValueOnce("Docker version 24.0.7")
        .mockResolvedValueOnce("Docker Compose version v2.23.0")
        .mockResolvedValueOnce("/usr/bin/curl")
        .mockResolvedValueOnce("/usr/bin/restic")
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce("systemd 252");

      const { register } = await import("../healthCheck.js");
      const handler = captureHandler(register);
      const result = await handler({});

      const text = result.content[0].text;
      expect(text).toContain("[PASS] SSH connectivity");
      expect(text).toContain("[PASS] Docker");
      expect(text).toContain("[FAIL] certbot");
      expect(text).toContain("6/7 checks passed");
    });

    it("passes node parameter to execSSH", async () => {
      mockExecSSH.mockResolvedValue("ok");

      const { register } = await import("../healthCheck.js");
      const handler = captureHandler(register);
      await handler({ node: "nas" });

      for (const call of mockExecSSH.mock.calls) {
        expect(call[1]).toBe("nas");
      }
    });
  });

  describe("diagnostics", () => {
    it("returns formatted diagnostic bundle", async () => {
      mockExecSSH.mockResolvedValue("mock output");

      const { register } = await import("../diagnostics.js");
      const handler = captureHandler(register);
      const result = await handler({});

      const text = result.content[0].text;
      expect(text).toContain("=== OS ===");
      expect(text).toContain("=== Kernel ===");
      expect(text).toContain("=== Docker ===");
      expect(text).toContain("=== Memory ===");
      expect(text).toContain("mock output");
    });

    it("handles individual section failures gracefully", async () => {
      mockExecSSH
        .mockResolvedValueOnce("Debian GNU/Linux 12")
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("ok");

      const { register } = await import("../diagnostics.js");
      const handler = captureHandler(register);
      const result = await handler({});

      const text = result.content[0].text;
      expect(text).toContain("=== OS ===");
      expect(text).toContain("Debian GNU/Linux 12");
      expect(text).toContain("(unavailable)");
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

      expect(result.content[0].text).toContain("aborted");
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

      expect(result.content[0].text).toContain("aborted");
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
      expect(text).toContain("default (raspi5.local) -- online");
      expect(text).toContain("nas (nas.local) -- offline");
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
