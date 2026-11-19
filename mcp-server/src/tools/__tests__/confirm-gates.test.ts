import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("../../utils/ssh-api.js", async (importOriginal) => ({
  assertCommandSafe: (await importOriginal<typeof import("../../utils/ssh-api.js")>()).assertCommandSafe,
  execSSH: vi.fn(),
  errorResponse: vi.fn((error: unknown) => ({
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Unknown error" }],
    isError: true,
  })),
  nodeSetting: vi.fn((_node: string | undefined, key: string) => process.env[key] || undefined),
  getNodeConfig: vi.fn(() => ({ host: "raspberrypi.local", username: "pi", keyPath: "", port: 22, env: {} })),
  listNodes: vi.fn(() => [{ name: "default", host: "raspberrypi.local" }]),
  TIMEOUTS: { long: 1_800_000, backup: 3_600_000, medium: 300_000 },
}));

import { execSSH } from "../../utils/ssh-api.js";
import * as piReboot from "../piReboot.js";
import * as backupRun from "../backupRun.js";
import * as backupRestore from "../backupRestore.js";
import * as volumeBackup from "../volumeBackup.js";
import * as certRenew from "../certRenew.js";
import * as nodeExec from "../nodeExec.js";
import * as serviceRestart from "../serviceRestart.js";
import * as composeUp from "../composeUp.js";
import * as composeDown from "../composeDown.js";
import * as aptUpdate from "../aptUpdate.js";
import * as adguardFilterToggle from "../adguardFilterToggle.js";
import * as alertSilence from "../alertSilence.js";
import * as systemdControl from "../systemdControl.js";

const MODULES: Record<string, { register: (server: never) => void }> = {
  piReboot,
  backupRun,
  backupRestore,
  volumeBackup,
  certRenew,
  nodeExec,
  serviceRestart,
  composeUp,
  composeDown,
  aptUpdate,
  adguardFilterToggle,
  alertSilence,
  systemdControl,
};

const mockExecSSH = vi.mocked(execSSH);

type Register = (server: unknown) => void;

/**
 * Every tool that changes running state, with minimal valid args (minus
 * `confirm`) and a fragment of the command it must run once confirmed.
 */
const GATED: Array<[tool: string, file: string, args: Record<string, unknown>, expected: string]> = [
  ["homelab_piReboot", "piReboot", {}, "sudo shutdown -r +0"],
  ["homelab_backupRun", "backupRun", {}, "/opt/backup/backup.sh"],
  ["homelab_backupRestore", "backupRestore", { snapshot: "abc123", target: "/tmp/restore" }, "restore"],
  ["homelab_volumeBackup", "volumeBackup", { volume: "grafana_data" }, "backup"],
  ["homelab_certRenew", "certRenew", {}, "certbot renew"],
  ["homelab_nodeExec", "nodeExec", { node: "nas", command: "uptime" }, "uptime"],
  ["homelab_serviceRestart", "serviceRestart", { service: "grafana" }, "docker restart grafana"],
  ["homelab_composeUp", "composeUp", {}, "up -d --remove-orphans"],
  ["homelab_composeDown", "composeDown", {}, "down"],
  ["homelab_aptUpdate", "aptUpdate", { upgrade: true }, "apt-get upgrade -y"],
  ["homelab_adguardFilterToggle", "adguardFilterToggle", { url: "https://l.example/a.txt", enabled: false }, "/control/filtering/status"],
  ["homelab_alertSilence", "alertSilence", { action: "expire", id: "8e6c1b9a-6d1f-4c1e-9a43-0f5d2b7a9c10" }, "-X DELETE"],
  ["homelab_systemdControl", "systemdControl", { unit: "smbd", action: "restart" }, "sudo systemctl restart 'smbd'"],
];

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

function captureHandler(register: Register): Handler {
  let handler: Handler | null = null;
  register({
    registerTool: (_name: string, _config: unknown, h: Handler) => {
      handler = h;
    },
  });
  if (!handler) throw new Error("handler not captured");
  return handler as Handler;
}

async function load(file: string) {
  const mod = MODULES[file];
  if (!mod) throw new Error(`no module for ${file}`);
  return captureHandler(mod.register as Register);
}

describe("confirm gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecSSH.mockResolvedValue("installed");
  });

  it.each(GATED)("%s does nothing without confirm=true", async (_tool, file, args) => {
    const handler = await load(file);
    for (const confirm of [false, undefined]) {
      const result = await handler({ ...args, ...(confirm === undefined ? {} : { confirm }) });
      expect(result.content[0].text).toContain("cancelled");
    }
    expect(mockExecSSH).not.toHaveBeenCalled();
  });

  it.each(GATED)("%s previews its command without confirm and runs nothing", async (_tool, file, args, expected) => {
    const handler = await load(file);
    const text = (await handler({ ...args, confirm: false })).content[0].text;
    expect(text).toContain("Preview (nothing was run):");
    expect(text).toMatch(/Node: \w+ \(pi@raspberrypi\.local\)/);
    expect(text).toContain(expected);
    expect(mockExecSSH).not.toHaveBeenCalled();
  });

  it("masks credentials in previews", async () => {
    process.env.HOMELAB_ADGUARD_PASSWORD = "hunter2";
    try {
      const handler = await load("adguardFilterToggle");
      const text = (await handler({ url: "https://l.example/a.txt", enabled: false, confirm: false })).content[0].text;
      expect(text).toContain("curl -sf -u '****'");
      expect(text).not.toContain("hunter2");
    } finally {
      delete process.env.HOMELAB_ADGUARD_PASSWORD;
    }
  });

  it("says when the command guard would block the previewed command", async () => {
    const handler = await load("nodeExec");
    const text = (await handler({ node: "nas", command: "sudo poweroff", confirm: false })).content[0].text;
    expect(text).toContain("would be blocked");
  });

  it("systemdControl refuses to stop or disable sshd, even with confirm", async () => {
    const handler = await load("systemdControl");
    for (const unit of ["ssh", "sshd.service", "ssh.socket"]) {
      for (const action of ["stop", "disable"]) {
        const result = (await handler({ unit, action, confirm: true })) as { content: { text: string }[]; isError?: boolean };
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Refusing");
      }
    }
    expect(mockExecSSH).not.toHaveBeenCalled();
    await handler({ unit: "ssh", action: "reload", confirm: true });
    expect(String(mockExecSSH.mock.calls[0][0])).toContain("sudo systemctl reload 'ssh'");
  });

  it("systemdControl reports the unit state after the action", async () => {
    const handler = await load("systemdControl");
    mockExecSSH.mockResolvedValueOnce("active: active\nenabled: enabled");
    const text = (await handler({ unit: "smbd", action: "restart", confirm: true })).content[0].text;
    expect(String(mockExecSSH.mock.calls[0][0])).toContain("systemctl is-active 'smbd'");
    expect(text).toContain("systemctl restart smbd done.");
    expect(text).toContain("active: active");
  });

  it("reports invalid arguments in the preview", async () => {
    const handler = await load("composeDown");
    const text = (await handler({ stacks: ["compose.apps.yml"], removeVolumes: true, confirm: false })).content[0].text;
    expect(text).toContain("Preview unavailable: removeVolumes is only supported");
  });

  it.each(GATED)("%s runs its command with confirm=true", async (_tool, file, args, expected) => {
    const handler = await load(file);
    await handler({ ...args, confirm: true });
    const commands = mockExecSSH.mock.calls.map((c) => String(c[0]));
    expect(commands.some((c) => c.includes(expected))).toBe(true);
  });

  it("composeUp with stacks targets the stack's services without removing orphans", async () => {
    const handler = await load("composeUp");
    await handler({ stacks: ["compose.monitoring.yml"], confirm: true });
    const command = String(mockExecSSH.mock.calls[0][0]);
    expect(command).toContain("up -d $services");
    expect(command).not.toContain("--remove-orphans");
  });

  it("composeDown with stacks stops only the stack's services", async () => {
    const handler = await load("composeDown");
    await handler({ stacks: ["compose.monitoring.yml"], confirm: true });
    const command = String(mockExecSSH.mock.calls[0][0]);
    expect(command).toContain("stop $services");
    expect(command).toContain("rm -f $services");
    expect(command).not.toMatch(/\bdown\b/);
  });

  it("composeDown refuses removeVolumes for a stack subset", async () => {
    const handler = await load("composeDown");
    const result = await handler({ stacks: ["compose.apps.yml"], removeVolumes: true, confirm: true });
    expect(result.content[0].text).toContain("removeVolumes is only supported");
    expect(mockExecSSH).not.toHaveBeenCalled();
  });

  it("matches the gated tool list documented in CLAUDE.md", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const claude = readFileSync(join(here, "../../../../CLAUDE.md"), "utf8");
    const line = claude.split("\n").find((l) => l.includes("Tools that change running state require"));
    expect(line).toBeDefined();
    const documented = [...line!.matchAll(/`(homelab_[A-Za-z]+)`/g)].map((m) => m[1]).sort();
    expect(documented).toEqual(GATED.map(([tool]) => tool).sort());
  });
});
