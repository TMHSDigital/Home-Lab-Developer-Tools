import { z } from "zod";
import { assertCommandSafe, getNodeConfig } from "./ssh-api.js";

export const confirmParam = {
  confirm: z
    .boolean()
    .describe("Safety gate. Must be true to proceed; when false, the tool returns a preview of what it would run."),
};

/** What a confirm-gated tool would run, shown when it is called without confirm. */
export interface ConfirmPreview {
  node?: string;
  /** Built lazily so invalid arguments are reported in the preview. */
  commands: () => string[];
  /** Extra steps the commands alone do not show (pre-checks, follow-ups). */
  note?: string;
}

/** Hide credentials that commands carry inline (basic auth, bearer tokens, JSON passwords). */
export function maskCredentials(text: string): string {
  return text
    .replace(/(-u\s+')[^']*'/g, "$1****'")
    .replace(/(Authorization:\s*Bearer\s+)[^'"\s]+/gi, "$1****")
    .replace(/("(?:password|secret|token)"\s*:\s*")[^"]*"/gi, '$1****"');
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderPreview(preview: ConfirmPreview): string {
  const lines = ["Preview (nothing was run):"];
  try {
    const cfg = getNodeConfig(preview.node);
    const port = cfg.port && cfg.port !== 22 ? `:${cfg.port}` : "";
    lines.push(`Node: ${preview.node || "default"} (${cfg.username}@${cfg.host}${port})`);
    const commands = preview.commands();
    lines.push(commands.length > 1 ? "Commands:" : "Command:");
    for (const command of commands) {
      lines.push(`  ${maskCredentials(command)}`);
      try {
        assertCommandSafe(command);
      } catch (error) {
        lines.push(`  -> would be blocked: ${maskCredentials(message(error))}`);
      }
    }
  } catch (error) {
    lines.push(`Preview unavailable: ${maskCredentials(message(error))}`);
  }
  if (preview.note) lines.push(preview.note);
  return lines.join("\n");
}

export function confirmCancelled(
  action: string,
  preview?: ConfirmPreview,
): {
  content: { type: "text"; text: string }[];
} {
  let text = `${action} cancelled. Set confirm=true to proceed.`;
  if (preview) text += `\n\n${renderPreview(preview)}`;
  return {
    content: [{
      type: "text" as const,
      text,
    }],
  };
}
