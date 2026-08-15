/**
 * Narrative for searchMemories (Q↔Q weave search path).
 * Tool description, schema field describe, agent bullet, agent-recall style snippet.
 */

import { MEMORY_SEARCH_MAX_QUESTIONS } from "@/lib/policy-tokens";

/**
 * Short agent-stateful recall style guidance reused by system bullet and related copy.
 * Symmetric with MemoryQuestion generation (third-person about the user + synonyms).
 */
export const MEMORY_SEARCH_AGENT_RECALL_STYLE = `agent-stateful third-person probes about the user's knowledge
(e.g. "Has the user studied Dijkstra's algorithm?", "Does the user know about shortest-path algorithms?",
"Has the user seen graph pathfinding?")`;

/** `tool({ description })` for searchMemories in the product toolset. */
export const searchMemoriesToolDescription = `Semantic search over the knowledge graph via MemoryQuestion embeddings (Q↔Q).
Pass 1–${MEMORY_SEARCH_MAX_QUESTIONS} natural-language questions as agent-side recall probes:
third-person about whether the user already knows something
(e.g. "Has the user studied Dijkstra's algorithm?", "Does the user know about shortest-path algorithms?").
Expand synonyms / related concepts so a probe about "shortest path" can hit a Dijkstra Memory.
Multi-ANN + RRF returns Memory hits.
Use before create to avoid duplicates and to find ids for update/link.
Does not invent layout or write nodes.`;

/**
 * Zod `.describe(...)` for the `questions` field on searchMemories input schema.
 */
export const searchMemoriesQuestionsFieldDescription = `1–${MEMORY_SEARCH_MAX_QUESTIONS} natural-language questions —
agent-stateful third-person probes about the user's knowledge
(e.g. "Has the user studied React Server Components?", "Does the user know about Zustand?",
"Is the user familiar with client-side state libraries?").
Each is embedded; multi-ANN over MemoryQuestion nodes is fused with RRF into Memory hits.
Prefer synonym / related-concept diversity, not only the exact title keyword.
Not first-person user-meta ("What do I know about…?"); not generic fluff.`;

/** Short how-to bullet for the agent system prompt. */
export const SEARCH_MEMORIES_AGENT_BULLET = `You can pass 1–N natural-language questions in ${MEMORY_SEARCH_AGENT_RECALL_STYLE}.
Expand synonyms / related concepts (same family as stored MemoryQuestions) for better Q↔Q hits.
Multi-ANN + RRF over stored MemoryQuestions returns Memory hits.
Use before create to avoid duplicates and to find ids for update/link OR to find existing memories of the user for a better understanding of what the user already knows.`;
