import { spawnSync } from "node:child_process";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/ssh-api.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../utils/ssh-api.js")>(),
  execSSH: vi.fn(),
}));

import { execSSH } from "../../utils/ssh-api.js";
import { CommandFailedError, DryRunError } from "../../utils/errors.js";
import { register } from "../speedtestResults.js";

type Result = { content: { text: string }[]; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;
let handler: Handler;
let schema: z.ZodObject<z.ZodRawShape>;
register({
  registerTool: (_name: string, config: { inputSchema: z.ZodRawShape }, callback: Handler) => {
    schema = z.object(config.inputSchema);
    handler = callback;
  },
} as never);
const invoke = (args: Record<string, unknown> = {}) => handler(schema.parse(args));
const mockExecSSH = vi.mocked(execSSH);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("HOMELAB_SPEEDTEST_TOKEN", "1|example-token");
  vi.stubEnv("HOMELAB_SPEEDTEST_PORT", "");
  vi.stubEnv("HOMELAB_NODES", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("speedtestResults", () => {
  it.each([undefined, 10, 100])("requests up to %s newest results from the paginated API", async (count) => {
    const results = Array.from({ length: 120 }, (_, i) => ({ id: 120 - i }));
    mockExecSSH.mockImplementation(async (command) => {
      const url = new URL(command.match(/'([^']+)'$/)![1]);
      expect(url.pathname).toBe("/api/v1/results");
      expect(url.searchParams.get("sort")).toBe("-created_at");
      expect(url.searchParams.get("page[size]")).toBe(String(count ?? 5));
      expect(command).toContain("-H 'Accept: application/json'");
      expect(command).toContain("-H 'Authorization: Bearer 1|example-token'");
      return JSON.stringify({ data: results.slice(0, Number(url.searchParams.get("page[size]"))) });
    });
    const result = await invoke(count === undefined ? {} : { count });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).data).toEqual(results.slice(0, count ?? 5));
    expect(mockExecSSH).toHaveBeenCalledTimes(1);
  });

  it("keeps an empty result page intact", async () => {
    mockExecSSH.mockResolvedValueOnce('{"data":[],"meta":{"total":0}}');
    expect((await invoke()).content[0].text).toBe('{"data":[],"meta":{"total":0}}');
  });

  it("uses the target node's token and port overrides", async () => {
    vi.stubEnv("HOMELAB_NODES", JSON.stringify({
      nas: { host: "nas.local", env: { HOMELAB_SPEEDTEST_PORT: "9876", HOMELAB_SPEEDTEST_TOKEN: "2|nas-token" } },
    }));
    mockExecSSH.mockResolvedValueOnce('{"data":[]}');
    await invoke({ node: "nas", count: 3 });
    const [command, node] = mockExecSSH.mock.calls[0];
    expect(node).toBe("nas");
    expect(command).toContain("http://localhost:9876/api/v1/results?");
    expect(command).toContain("Authorization: Bearer 2|nas-token");
    expect(command).not.toContain("1|example-token");
  });

  it("explains the required token before opening an SSH connection", async () => {
    vi.stubEnv("HOMELAB_SPEEDTEST_TOKEN", "");
    const result = await invoke();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HOMELAB_SPEEDTEST_TOKEN");
    expect(result.content[0].text).toContain("results:read");
    expect(mockExecSSH).not.toHaveBeenCalled();
  });

  it("explains authentication and scope requirements after an HTTP error", async () => {
    mockExecSSH.mockRejectedValueOnce(new CommandFailedError("curl", 22, ""));
    const result = await invoke();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HOMELAB_SPEEDTEST_TOKEN");
    expect(result.content[0].text).toContain("results:read");
  });

  it.each([7, 28])("preserves curl error guidance for exit %s", async (code) => {
    mockExecSSH.mockRejectedValueOnce(new CommandFailedError("curl", code, ""));
    const result = await invoke();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(code === 7 ? "Could not connect" : "did not respond in time");
  });

  const hasSh = !spawnSync("sh", ["-c", "true"]).error;
  it.skipIf(!hasSh)("passes a token with shell metacharacters to curl unchanged", async () => {
    const token = "it's-$(printf expanded)-a-token";
    vi.stubEnv("HOMELAB_SPEEDTEST_TOKEN", token);
    mockExecSSH.mockResolvedValueOnce('{"data":[]}');
    await invoke();
    const command = mockExecSSH.mock.calls[0][0];
    const result = spawnSync("sh", ["-c", `curl() { printf '%s\\n' "$@"; }; ${command}`], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.split("\n")).toContain(`Authorization: Bearer ${token}`);
  });

  it.each(["1|example-token", "it's-a-token"])("redacts token %j in dry-run and command-failure output", async (token) => {
    vi.stubEnv("HOMELAB_SPEEDTEST_TOKEN", token);
    mockExecSSH.mockImplementationOnce(async (command) => { throw new DryRunError("pi.local", command); });
    const dryRun = await invoke();
    expect(dryRun.isError).toBeUndefined();
    expect(dryRun.content[0].text).toContain("Nothing was run (HOMELAB_DRY_RUN)");
    expect(dryRun.content[0].text).toContain("Authorization: Bearer ****");
    expect(dryRun.content[0].text).not.toContain(token);

    mockExecSSH.mockImplementationOnce(async (command) => { throw new CommandFailedError(command, 2, token); });
    const failure = await invoke();
    expect(failure.isError).toBe(true);
    expect(failure.content[0].text).toContain("Authorization: Bearer ****");
    expect(failure.content[0].text).not.toContain(token);
  });
});
