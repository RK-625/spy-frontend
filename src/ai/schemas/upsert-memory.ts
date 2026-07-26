import { z } from "zod";

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
      "Existing Memory id to update. Omit to create a new memory (a new id is generated).",
    ),
});

export type UpsertMemoryInput = z.infer<typeof upsertMemoryInputSchema>;
