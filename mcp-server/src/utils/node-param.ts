import { z } from "zod";

export const nodeParam = {
  node: z
    .string()
    .optional()
    .describe(
      "Target node name from the node registry. Uses default (primary Pi) if omitted",
    ),
};
