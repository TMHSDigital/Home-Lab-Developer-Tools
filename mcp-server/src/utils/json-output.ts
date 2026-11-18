/**
 * Helpers for tools that return JSON from a remote command.
 *
 * execSSH keeps only the last HOMELAB_MAX_OUTPUT_BYTES of output and marks
 * the cut with a "[output truncated: ...]" line. JSON cut from the front no
 * longer parses, so JSON tools report the overflow instead of returning it.
 */

export const TRUNCATION_MARKER = "[output truncated:";

/** Return `output` unchanged, or throw when execSSH had to cut it. */
export function completeJson(output: string): string {
  if (output.startsWith(TRUNCATION_MARKER)) {
    const total = /of (\d+) bytes/.exec(output)?.[1];
    throw new Error(
      `The response${total ? ` (${total} bytes)` : ""} was larger than HOMELAB_MAX_OUTPUT_BYTES ` +
        "and was cut, so it is not valid JSON. Narrow the request (filters, count, a smaller query) " +
        "or raise HOMELAB_MAX_OUTPUT_BYTES.",
    );
  }
  return output;
}
