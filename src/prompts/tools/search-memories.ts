/**
 * Narrative for searchMemories (Q↔Q graph search path).
 * Tool description + chat/graph bullets + field describes + shared recall-style snippet.
 */

import {
  MEMORY_SEARCH_MAX_DISTANCE,
  MEMORY_SEARCH_MAX_QUESTIONS,
} from "@/lib/graph/policy";

/**
 * Short agent-stateful recall style guidance reused by search field copy and upsert questions.
 * Symmetric with stored MemoryQuestion probes (third-person about the user + synonyms).
 */
export const MEMORY_SEARCH_AGENT_RECALL_STYLE = `agent-stateful third-person probes about the user's knowledge
(e.g. "Has the user studied Dijkstra's algorithm?", "Does the user know about shortest-path algorithms?",
"Has the user seen graph pathfinding?")`;

/** `tool({ description })` for searchMemories in the product toolset. */
export const searchMemoriesToolDescription = `Semantic search over the knowledge graph (Q↔Q ANN).
Pass 1–${MEMORY_SEARCH_MAX_QUESTIONS} third-person recall probes; each is embedded and searched independently.
results[i] is that probe's survivors ({id, name, score}). score is cosine distance: 0 = identical, smaller = closer; hits with score > ${MEMORY_SEARCH_MAX_DISTANCE} are omitted.
Empty inner list = that probe missed; all empty = no stored match (retry with a different probe set if needed).
Does not write nodes or invent layout.`;

/** Short how-to bullet for the chat-agent system prompt. */
export const SEARCH_MEMORIES_CHAT_BULLET = `Semantic recall to understand what the user already knows and ground the teaching response.
Does not write nodes or invent ids.`;

/** Short how-to bullet for the graph-agent system prompt. */
export const SEARCH_MEMORIES_GRAPH_BULLET = `Semantic recall to find related Memories before create, refine, or attach; reuse over duplicates.
Does not write nodes or invent ids.`;

/** Zod `.describe(...)` for the `questions` field on searchMemories input schema. */
export const searchMemoriesQuestionsFieldDescription = `1–${MEMORY_SEARCH_MAX_QUESTIONS} ${MEMORY_SEARCH_AGENT_RECALL_STYLE}.
Each string is one probe; results[i] is that probe's hit list.
Not first-person user-meta; not generic fluff; not title-only keyword spam.`;
