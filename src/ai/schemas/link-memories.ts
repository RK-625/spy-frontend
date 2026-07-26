import { z } from "zod";

export const linkMemoriesInputSchema = z.object({
  source: z
    .string()
    .describe(
      "Memory id of the source node. For PART_OF this MUST be the child (the more specific node that is part of a parent).",
    ),
  target: z
    .string()
    .describe(
      "Memory id of the target node. For PART_OF this MUST be the parent (the broader containing concept).",
    ),
  type: z
    .enum(["PART_OF", "RELATES_TO"])
    .describe(
      "PART_OF: hierarchical child→parent (source=child, target=parent). RELATES_TO: associative link between related concepts with no hierarchy.",
    ),
});

export type LinkMemoriesInput = z.infer<typeof linkMemoriesInputSchema>;
