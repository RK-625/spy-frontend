/**
 * Numeric policy knobs shared across server tools and DB.
 * Parallel to `icon-tokens.ts` — keep this file generic for future tokens.
 */

/** Target count of MemoryQuestion nodes written per Memory (within 5–8). */
export const MEMORY_QUESTIONS_PER_MEMORY = 6;

/** Inclusive bounds for questions generated per Memory (product path uses PER_MEMORY). */
export const MEMORY_QUESTION_COUNT_MIN = 5;
export const MEMORY_QUESTION_COUNT_MAX = 8;

/** Max natural-language questions accepted by searchMemories tool. */
export const MEMORY_SEARCH_MAX_QUESTIONS = 5;

/** Fixed result count for Memory vector search (tool + falkor). */
export const MEMORY_SEARCH_TOP_K = 10;

/**
 * Max ANN cosine DISTANCE for a probe hit to survive (per-probe ceiling; not fused).
 * FalkorDB `db.idx.vector.queryNodes` (cosine) yields DISTANCE: 0 = identical
 * text, larger = farther apart. 0.35 keeps hits with similarity >= 0.65.
 */
export const MEMORY_SEARCH_MAX_DISTANCE = 0.35;
