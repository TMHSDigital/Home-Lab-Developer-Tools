import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH } from "../utils/ssh-api.js";
import { forNodes, nodeOrAllParam } from "../utils/fan-out.js";
import { sectionScript, BASE_STATUS_SECTIONS } from "../utils/section-script.js";
import { READ_ONLY } from "../utils/annotations.js";

/** Run a vcgencmd subcommand, or print N/A on nodes without it (non-Pi hardware). */
function vcgencmd(args: string): string {
  return `if command -v vcgencmd >/dev/null 2>&1; then vcgencmd ${args}; else echo 'N/A'; fi`;
}

export const STATUS_COMMAND = sectionScript([
  ...BASE_STATUS_SECTIONS,
  ["ARM Clock", vcgencmd("measure_clock arm")],
  ["Core Voltage", vcgencmd("measure_volts core")],
  ["Throttle Status", vcgencmd("get_throttled")],
]);

/** get_throttled bits: n is "now", n + 16 is "has occurred since boot". */
const THROTTLE_FLAGS: Array<[bit: number, label: string]> = [
  [0, "Under-voltage"],
  [1, "ARM frequency capped"],
  [2, "Throttled"],
  [3, "Soft temperature limit"],
];

/** Decode a get_throttled value (e.g. 0x50005) into one readable line per flag. */
export function decodeThrottled(value: number): string[] {
  const yes = (bit: number) => ((value >>> bit) & 1 ? "YES" : "no");
  return THROTTLE_FLAGS.map(([bit, label]) => `${label}: now ${yes(bit)}, since boot ${yes(bit + 16)}`);
}

/**
 * Add readable lines under the raw vcgencmd values: decoded throttle flags
 * after `throttled=0x...` and MHz after `frequency(N)=<Hz>`.
 */
export function annotateStatus(output: string): string {
  return output
    .split("\n")
    .flatMap((line) => {
      const throttled = /^throttled=(0x[0-9a-fA-F]+)$/.exec(line.trim());
      if (throttled) return [line, ...decodeThrottled(parseInt(throttled[1], 16))];
      const clock = /^frequency\(\d+\)=(\d+)$/.exec(line.trim());
      if (clock) return [`${line} (${Math.round(Number(clock[1]) / 1e6)} MHz)`];
      return [line];
    })
    .join("\n");
}

export function register(server: McpServer): void {
  server.registerTool(
    "homelab_piStatus",
    {
      description:
        'Get Raspberry Pi system status: CPU temp, memory, disk, uptime, ARM clock, core voltage, and decoded throttle flags (node: "all" for every node)',
      inputSchema: { ...nodeOrAllParam },
      annotations: READ_ONLY,
    },
    async (args) => forNodes(args.node, async (node) => annotateStatus(await execSSH(STATUS_COMMAND, node))),
  );
}
