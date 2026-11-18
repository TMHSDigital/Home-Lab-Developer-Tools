import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP tool annotations. They let clients auto-approve read-only calls and warn
 * before state-changing ones. Hints only: the confirm gate stays the guard.
 */

/** Only reads state on the node or its services. */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
};

/** Changes state without removing anything (pulls images, sends a notification). */
export function changesState(idempotent: boolean): ToolAnnotations {
  return { readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent };
}

/** Confirm-gated: can stop services, overwrite data or run arbitrary commands. */
export function destructive(idempotent: boolean): ToolAnnotations {
  return { readOnlyHint: false, destructiveHint: true, idempotentHint: idempotent };
}
