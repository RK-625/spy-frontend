import { z } from "zod";

/**
 * Tool input for directed Memory edges. Geometry is system-owned after the link.
 * No coordinates or rank on this schema.
 */
export const linkMemoriesInputSchema = z.object({
  source: z
    .string()
    .describe(
      "Memory id of the source node. Both nodes must already exist (upsert first). " +
        "For PART_OF this MUST be the child (more specific node). " +
        "Do not pass canvas coordinates — the system places the source when needed.",
    ),
  target: z
    .string()
    .describe(
      "Memory id of the target node. Both nodes must already exist. " +
        "For PART_OF this MUST be the parent (broader containing concept). Parent stays put on the canvas; only the child may be re-placed near the parent.",
    ),
  type: z
    .enum(["PART_OF", "RELATES_TO"])
    .describe(
      "PART_OF: hierarchical child→parent (source=child, target=parent). System repositions the child near the parent and sets rank = parent.rank + 1; parent is not moved. " +
        "RELATES_TO: associative link with no hierarchy; system may place source only if it still has no layout (near target). " +
        "Reparent / intermediate nodes: your job is correct links (and removing a wrong old PART_OF when that is supported); geometry and rank are system-derived after edges are right.",
    ),
});

export type LinkMemoriesInput = z.infer<typeof linkMemoriesInputSchema>;
