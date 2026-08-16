/**
 * Narrative + Q-gen prompts for upsertMemory (weave write path).
 * Tool description, agent bullet, generation system, and short user-message prefix.
 * Toolset builds the user message as prefix + JSON.stringify(memory).
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_QUESTIONS_PER_MEMORY,
} from "@/lib/policy-tokens";

/** Policy-derived target count for MemoryQuestion generation. */
export const MEMORY_QUESTION_COUNT_TARGET =
  Math.max(MEMORY_QUESTION_COUNT_MIN, MEMORY_QUESTIONS_PER_MEMORY);

/** `tool({ description })` for upsertMemory in the product toolset. */
export const upsertMemoryToolDescription = `Create or update a Memory node in the knowledge graph.
Use for durable facts, concepts, or explanations worth weaving into the user's web.
Prefer small focused memories; omit id to create, pass id to update content only.
The system auto-generates agent-side retrieval questions via LLM for later Q↔Q search —
do not invent or pass questions yourself.
Do not pass canvas coordinates or rank — placement is client-side on the graph map.
Structure via linkMemories.`;

/** Short how-to bullet for the agent system prompt. */
export const UPSERT_MEMORY_AGENT_BULLET = `create (omit id) or update (pass id).
Name the topic (stripped vessel), not the article/problem/snippet title.
Same topic → same id; new topic + existing parent → child; else root.
Append takeaway + Derived from: lines (never drop existing ones).
The system auto-generates retrieval questions via LLM for Q↔Q search — do **not** invent or pass questions.`;

/** Zod `.describe(...)` for the `name` field on upsertMemory input schema. */
export const upsertMemoryNameFieldDescription = `Short topic label for the graph — the concept, not the vessel
(e.g. 'DP on arrays' not 'LeetCode 198 House Robber'; 'TCP handshake' not 'why did my connection fail').`;

/** Zod `.describe(...)` for the `content` field on upsertMemory input schema. */
export const upsertMemoryContentFieldDescription = `The pattern, method, or takeaway — not a raw problem statement or session dump.
One concept per node. End with a Derived from: list; on update, keep old lines and append new sources.`;

/** Zod `.describe(...)` for the optional `impression` field on upsertMemory input schema. */
export const upsertMemoryImpressionFieldDescription = `Spy's evolving read of how the user relates to this memory —
their grasp, interest, confusion, or emotional angle.`;

/** Zod `.describe(...)` for the optional `confidence` field on upsertMemory input schema. */
export const upsertMemoryConfidenceFieldDescription = `How solid the user's grasp of this memory is, from 0 (uncertain) to 1 (firm).`;

/** Zod `.describe(...)` for the optional `id` field on upsertMemory input schema. */
export const upsertMemoryIdFieldDescription = `Existing Memory id to update content/name/impression/confidence.
Omit to create a new memory (system generates id).
Updates change content only.
Structure (PARENT_OF / RELATES_TO) is via linkMemories, not this tool.
Intermediate hierarchy: create nodes here, then link correctly.`;

/**
 * Short user-message prefix for MemoryQuestion Q-gen.
 * Toolset appends Memory JSON (name, content, optional impression/confidence) below.
 * Count policy lives in {@link memoryQuestionsGenerationSystem} — do not invent counts here.
 */
export const MEMORY_QUESTIONS_USER_PROMPT_PREFIX = `Generate agent-stateful third-person retrieval probes for the Memory node in the JSON below.
Use only that node's fields. Do not invent facts outside it.`;

/**
 * System instruction for LLM generation of MemoryQuestion retrieval texts.
 * Used only by upsertMemory Q-gen in the toolset (not the chat agent system prompt).
 * User message = {@link MEMORY_QUESTIONS_USER_PROMPT_PREFIX} + Memory JSON.
 */
export const memoryQuestionsGenerationSystem = `You generate retrieval questions for a Memory in a **user knowledge graph**.

## Retrieval preamble
This is not a public encyclopedia and not a first-person user notebook.
Questions are **agent-side recall probes**: things the agent would ask itself to stay stateful
about whether *this user* already has related knowledge.
At search time the agent embeds the same family of probes; nearest stored questions win (Q↔Q ANN).
Keep this short — no full graph essay, no PARENT_OF/canvas layout.

## Purpose
Power Q↔Q semantic search.
Search will embed agent probes of the same style and match them to the questions you store here.
Write probes that should retrieve *this* Memory when the agent later wonders about related knowledge.

## Input
The user message is a short instruction prefix followed by Memory JSON with:
- **name** — memory title
- **content** — memory body
- optionally **impression** and/or **confidence**

No task wrapper. Count policy is in the Count section below.

## Style (agent-stateful, third-person about the user)
Voice: third-person about the user — the agent pondering what the user knows.
Prefer this family:

- Has the user studied …?
- Does the user know about …?
- Has the user seen …?
- Has the user learned …?
- Is the user familiar with …?
- Does the user understand …?
- Has the user encountered …?
- Does the user have notes on …?
- Has the user worked with …?
- Does the user know how … works?
- Is … part of the user's knowledge?

### Synonyms and related concepts (critical)
Do **not** only restate the Memory title keyword.
Expand to synonyms, related algorithms/concepts, and natural phrasings so a later search
about a related idea can still hit this Memory.

Example story: Memory about **Dijkstra's algorithm** should store probes about
Dijkstra *and* shortest paths *and* graph pathfinding / graph algorithms — not only
"Has the user studied Dijkstra's algorithm?"
Later, if the agent asks "Does the user know about shortest-path algorithms?", ANN can match.

Vary wording; do not clone the same stem for every item.

## Grounding
- Base every question on the Memory name and content (and impression/confidence when given).
- Specific enough that this Memory is a good answer; not generic fluff that any node could match.
- No vectors, embeddings, coordinates, rank, or layout talk.
- Do not invent facts that are not in the provided Memory fields.

## Count
Return preferably ${MEMORY_QUESTION_COUNT_TARGET} questions (allowed range ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} inclusive).
Prefer the target; stay within min–max.

## Anti-patterns (reject these)
- First-person user-meta ("What do I know about…?", "What have I learned regarding…?")
- Duplicates or near-duplicates (same meaning, reworded)
- Vague fluff: "What is this?", "Tell me more", "Any notes?", "Does the user know things?"
- Questions this Memory cannot answer
- Wikipedia-only / pure encyclopedia phrasing with no user-knowledge framing
  (e.g. only "What is Dijkstra?" with no "does the user know / has the user studied" frame)
- Title-only keyword spam with no synonym / related-concept diversity
- Meta questions about the KB system itself

Output only the structured list of question strings.`;
