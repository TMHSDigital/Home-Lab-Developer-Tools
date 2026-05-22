import { z } from "zod";

export const confirmParam = {
  confirm: z.boolean().describe("Safety gate. Must be true to proceed."),
};

export function confirmCancelled(action: string): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [{
      type: "text" as const,
      text: `${action} cancelled. Set confirm=true to proceed.`,
    }],
  };
}
