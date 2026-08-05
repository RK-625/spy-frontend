import { z } from "zod";
import { MEMORY_SEARCH_MAX_QUESTIONS } from "@/lib/policy-tokens";
import { searchMemoriesQuestionsFieldDescription } from "@/prompts/tools/search-memories";

/**
 * Tool input for Q↔Q Memory search over the knowledge graph.
 * Embeddings are generated server-side from each question; the LLM never passes vectors.
 */
export const searchMemoriesInputSchema = z.object({
  questions: z
    .array(z.string().min(1))
    .min(1)
    .max(MEMORY_SEARCH_MAX_QUESTIONS)
    .describe(searchMemoriesQuestionsFieldDescription),
});

export type SearchMemoriesInput = z.infer<typeof searchMemoriesInputSchema>;
