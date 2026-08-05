import { z } from "zod";
import { MEMORY_SEARCH_MAX_QUESTIONS } from "@/lib/policy-tokens";

/**
 * Tool input for Q↔Q Memory search over the knowledge graph.
 * Embeddings are generated server-side from each question; the LLM never passes vectors.
 */
export const searchMemoriesInputSchema = z.object({
  questions: z
    .array(z.string().min(1))
    .min(1)
    .max(MEMORY_SEARCH_MAX_QUESTIONS)
    .describe(
      [
        `1–${MEMORY_SEARCH_MAX_QUESTIONS} natural-language questions in user-meta style about what the user might already know (e.g. "What do I know about React Server Components?", "What have I learned regarding Zustand?").`,
        "Each is embedded; multi-ANN over MemoryQuestion nodes is fused with RRF into Memory hits.",
        "Prefer first-person knowledge questions grounded in the topic — not generic fluff.",
      ].join(" "),
    ),
});

export type SearchMemoriesInput = z.infer<typeof searchMemoriesInputSchema>;
