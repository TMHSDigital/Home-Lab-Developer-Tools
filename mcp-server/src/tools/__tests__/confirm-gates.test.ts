import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("../../utils/ssh-api.js", () => ({
  execSSH: vi.fn(),
  errorResponse: vi.fn((error: unknown) => ({
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Unknown error" }],
    isError: true,
  })),
  nodeSetting: vi.fn((_node: string | undefined, key: string) => process.env[key] || undefined),
  getNodeConfig: vi.fn(() => ({ host: "raspberrypi.local", username: "pi", keyPath: "", env: {} })),
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
];

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

function captureHandler(register: Register): Handler {
  let handler: Handler | null = null;
  register({
    tool: (_name: string, _desc: string, _schema: unknown, h: Handler) => {
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

  it.each(GATED)("%s runs its command with confirm=true", async (_tool, file, args, expected) => {
    const handler = await load(file);
    await handler({ ...args, confirm: true });
    const commands = mockExecSSH.mock.calls.map((c) => String(c[0]));
    expect(commands.some((c) => c.includes(expected))).toBe(true);
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
