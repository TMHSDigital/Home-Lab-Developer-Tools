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

type TextResult = { content: { type: "text"; text: string }[]; isError?: boolean };

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

/**
 * Like forNodes, for tools whose single-node handler already builds a full
 * result (with tool-specific error hints). One node: the handler's result
 * unchanged. "all": the handler runs for every node in parallel, each
 * result's text becomes that node's section, and a result with isError
 * counts that node as failed. State-changing tools must not use this.
 */
export async function fanOut(
  node: string | undefined,
  handler: (node: string | undefined) => Promise<TextResult>,
): Promise<TextResult> {
  if (node !== ALL_NODES) return handler(node);
  return forNodes(ALL_NODES, async (n) => {
    const result = await handler(n);
    const text = result.content.map((c) => c.text).join("\n");
    if (result.isError) throw new Error(text);
    return text;
  });
}
