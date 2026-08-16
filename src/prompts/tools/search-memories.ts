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
First classify the turn (surface → topic → one parent), then pass 1–${MEMORY_SEARCH_MAX_QUESTIONS} probes covering that family — not only the title they typed
(e.g. a House Robber puzzle → DP on arrays + dynamic programming).
(e.g. a Dijkstra → shortest path algorithm + Graph Data Structures).
Expand synonyms / related concepts so a probe about surface can hit the correct memories or parent memories for example - "shortest path" can hit a Dijkstra Memory.
Probes are agent-side recall: third-person about whether the user already knows something.
Multi-ANN + RRF returns Memory hits.
Use before create to find a same-pattern id, a parent, or children to adopt.
Does not invent layout or write nodes.`;

/**
 * Zod `.describe(...)` for the `questions` field on searchMemories input schema.
 */
export const searchMemoriesQuestionsFieldDescription = `1–${MEMORY_SEARCH_MAX_QUESTIONS} natural-language questions —
agent-stateful third-person probes covering surface + pattern/topic + one parent
(e.g. "Has the user studied House Robber?", "Does the user know DP on arrays?",
"Has the user studied dynamic programming?").
Each is embedded; multi-ANN + RRF returns Memory hits.
Not first-person user-meta; not generic fluff; not title-only.`;

/** Short how-to bullet for the agent system prompt. */
export const SEARCH_MEMORIES_AGENT_BULLET = `You can pass 1–N natural-language questions in ${MEMORY_SEARCH_AGENT_RECALL_STYLE}.
Expand synonyms / related concepts (same family as stored MemoryQuestions) for better Q↔Q hits.
Multi-ANN + RRF over stored MemoryQuestions returns Memory hits.
Classify the turn first, then probe surface + pattern + one parent.
Use hits to refine the same-pattern id, hang under a parent, or adopt children.`;
