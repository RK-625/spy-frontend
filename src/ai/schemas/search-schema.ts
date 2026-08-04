import { z } from "zod";

/**
 * Tool input for semantic Memory search over the knowledge graph.
 * Embeddings are generated server-side from `query`; the LLM never passes vectors.
 */
export const searchMemoriesInputSchema = z.object({
  query: z
    .string()
    .describe(
      "Natural-language search over the user's knowledge graph (concepts, facts, related memories).",
    ),
});

export type SearchMemoriesInput = z.infer<typeof searchMemoriesInputSchema>;
