import { expect } from "vitest";
import { z } from "zod";

type Result = { content: { text: string }[]; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

/** Run the shipped handler with schema defaults, as the MCP server does. */
export async function runTool(register: (server: never) => void, args: Record<string, unknown> = {}): Promise<string> {
  let handler: Handler | undefined;
  let shape: z.ZodRawShape = {};
  register({
    registerTool: (_n: string, config: { inputSchema: z.ZodRawShape }, h: Handler) => {
      shape = config.inputSchema;
      handler = h;
    },
  } as never);
  if (!handler) throw new Error("handler not captured");
  const result = await handler(z.object(shape).parse(args));
  const text = result.content[0]?.text ?? "";
  expect(result.isError, text).toBeFalsy();
  expect(text.length).toBeGreaterThan(0);
  return text;
}
