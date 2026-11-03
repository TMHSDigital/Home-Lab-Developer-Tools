import { z } from "zod";

/**
 * Relative durations (30s, 10m, 2h, 7d) or an ISO 8601 date/time
 * (2024-05-01, 2024-05-01T12:00, 2024-05-01T12:00:00Z).
 */
export const SINCE_RE =
  /^(\d{1,6}[smhd]|\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?)?)$/;

export function sinceSchema(description: string) {
  return z
    .string()
    .regex(SINCE_RE, "Use a duration like 30m, 2h, 7d or an ISO date like 2024-05-01T12:00:00Z")
    .describe(description);
}

/**
 * Convert to a value `docker logs --since` accepts. Docker parses Go
 * durations, which have no day unit, so "7d" becomes "168h".
 */
export function toDockerSince(since: string): string {
  const days = /^(\d+)d$/.exec(since);
  return days ? `${Number(days[1]) * 24}h` : since;
}
