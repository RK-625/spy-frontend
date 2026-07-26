import { z } from "zod";

/**
 * Tool input for create/update Memory. Canvas layout (x, y, rank) is
 * system-owned — never present on this schema; the LLM must not invent coordinates.
 */
export const upsertMemoryInputSchema = z.object({
  name: z
    .string()
    .describe(
      "Short title / node label for the knowledge graph (e.g. 'React Server Components', not a full paragraph).",
    ),
  content: z
    .string()
    .describe(
      "Facts, knowledge, or a clear explanation to store on this memory. Keep focused — one concept per node when possible.",
    ),
  impression: z
    .string()
    .optional()
    .describe(
      "Spy's evolving read of how the user relates to this knowledge — their grasp, interest, confusion, or emotional angle. Omit if unknown.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "How solid the user's grasp of this memory is, from 0 (uncertain) to 1 (firm). Omit if unknown; defaults to 0.5.",
    ),
  id: z
    .string()
    .optional()
    .describe(
      "Existing Memory id to update content/name/impression/confidence. Omit to create a new memory (system generates id). " +
        "Updates do not move the node on the canvas — existing x/y/rank are preserved. " +
        "Do NOT pass or invent canvas coordinates (x, y) or rank; layout is system-owned. " +
        "Structure (PART_OF / RELATES_TO) is via linkMemories, not this tool. " +
        "Intermediate hierarchy: create nodes here, then link correctly; the system places children after PART_OF links.",
    ),
});

export type UpsertMemoryInput = z.infer<typeof upsertMemoryInputSchema>;
