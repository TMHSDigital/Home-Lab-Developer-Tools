import { afterEach, beforeEach, vi, type MockedFunction } from "vitest";

type SSHModule = typeof import("../../../utils/ssh-api.js");

/** Keep config, guards, timeouts and error handling real; replace only transport. */
export function mockSSHModule(actual: SSHModule) {
  return { ...actual, execSSH: vi.fn<SSHModule["execSSH"]>() };
}

/** Reset queued replies and implementations even after a failed assertion. */
export function useSSHMock(exec: MockedFunction<SSHModule["execSSH"]>, nodes: Record<string, unknown> = {}) {
  let savedEnv: Record<string, string> = {};
  const homelabKeys = () => Object.keys(process.env).filter((key) => key.startsWith("HOMELAB_"));
  beforeEach(() => {
    exec.mockReset();
    savedEnv = Object.fromEntries(homelabKeys().map((key) => [key, process.env[key]!]));
    for (const key of homelabKeys()) delete process.env[key];
    process.env.HOMELAB_PI_HOST = "raspberrypi.local";
    process.env.HOMELAB_PI_USER = "pi";
    process.env.HOMELAB_NODES = JSON.stringify(nodes);
  });
  afterEach(() => {
    exec.mockReset();
    vi.unstubAllEnvs();
    for (const key of homelabKeys()) delete process.env[key];
    Object.assign(process.env, savedEnv);
  });
}
