import { z } from "zod";

/**
 * Tool input for directed Memory edges.
 * Topology only — tools never author canvas geometry or rank.
 * Graph client derives rank from PART_OF and places nodes from topology/cache.
 */
export const linkMemoriesInputSchema = z.object({
  source: z
    .string()
    .describe(
      "Memory id of the source node. Both nodes must already exist (upsert first). " +
        "For PART_OF this MUST be the child (more specific node). " +
        "Do not pass canvas coordinates or rank — tools never author geometry.",
    ),
  target: z
    .string()
    .describe(
      "Memory id of the target node. Both nodes must already exist. " +
        "For PART_OF this MUST be the parent (broader containing concept).",
    ),
  type: z
    .enum(["PART_OF", "RELATES_TO"])
    .describe(
      "PART_OF: hierarchical child→parent (source=child, target=parent). " +
        "RELATES_TO: associative link with no hierarchy. " +
        "Your job is correct links only (and removing a wrong old PART_OF when that is supported). " +
        "The graph client derives rank from PART_OF and places nodes from topology/cache; tools never author geometry.",
    ),
});

export type LinkMemoriesInput = z.infer<typeof linkMemoriesInputSchema>;
