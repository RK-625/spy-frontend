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

/** RRF constant k for multi-query fusion over MemoryQuestion ANN hits. */
export const MEMORY_SEARCH_RRF_K = 60;
