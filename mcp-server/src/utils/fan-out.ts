import { z } from "zod";
import { errorResponse, listNodes } from "./ssh-api.js";
import { DryRunError } from "./errors.js";

/** Value of `node` that runs a read-only tool on every registered node. */
export const ALL_NODES = "all";

/** `node` parameter for read-only tools that can fan out to every node. */
export const nodeOrAllParam = {
  node: z
    .string()
    .optional()
    .describe(
      'Target node name from the node registry, or "all" for every node in one call. ' +
        "Uses default (primary Pi) if omitted",
    ),
};

type TextResult = { content: { type: "text"; text: string }[]; isError?: true };

function message(error: unknown): string {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

/**
 * Run `read` for one node, or for every node in parallel when node is "all".
 * Fan-out returns one section per node with per-node errors; it is an error
 * only when every node failed. State-changing tools must not use this.
 */
export async function forNodes(
  node: string | undefined,
  read: (node: string | undefined) => Promise<string>,
): Promise<TextResult> {
  if (node !== ALL_NODES) {
    try {
      return { content: [{ type: "text", text: await read(node) }] };
    } catch (error) {
      return errorResponse(error);
    }
  }

  let nodes: { name: string; host: string }[];
  try {
    nodes = listNodes();
  } catch (error) {
    return errorResponse(error);
  }
  const results = await Promise.allSettled(
    nodes.map((n) => read(n.name === "default" ? undefined : n.name)),
  );
  const sections = nodes.map((n, i) => {
    const r = results[i];
    const body =
      r.status === "fulfilled"
        ? r.value
        : r.reason instanceof DryRunError
          ? r.reason.message
          : `Error: ${message(r.reason)}`;
    return `=== ${n.name} (${n.host}) ===\n${body}`;
  });
  const failed = results.filter((r) => r.status === "rejected" && !(r.reason instanceof DryRunError)).length;
  const summary = `${nodes.length - failed} of ${nodes.length} nodes responded.`;
  const text = `${summary}\n\n${sections.join("\n\n")}`;
  return failed === nodes.length
    ? { content: [{ type: "text", text }], isError: true }
    : { content: [{ type: "text", text }] };
}
