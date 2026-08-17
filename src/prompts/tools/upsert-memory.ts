/**
 * Narrative prompts for upsertMemory (weave write path).
 * Tool description, agent bullet, and schema field describes.
 * Retrieval questions are agent-authored; the tool only embeds them.
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_QUESTIONS_PER_MEMORY,
} from "@/lib/policy-tokens";
import { MEMORY_SEARCH_AGENT_RECALL_STYLE } from "./search-memories";

/** Policy-derived target count for MemoryQuestion field copy. */
export const MEMORY_QUESTION_COUNT_TARGET = Math.max(
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_QUESTIONS_PER_MEMORY,
);

/** `tool({ description })` for upsertMemory in the product toolset. */
export const upsertMemoryToolDescription = `Create or patch a Memory node in the knowledge graph.
Use for durable facts, concepts, or explanations worth weaving into the user's web.
Prefer small focused memories.
Omit id to create (name, content, impression, confidence, and questions all required).
Pass id to patch only the fields you send — do not resend unchanged content.
When creating or patching name/content, pass ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} agent-side retrieval probes (probe style on the questions field); the system embeds and replaces the stored set.
Impression/confidence-only patches are valid — omit questions (no re-embed).
Questions-only patches are valid (refresh probes without rewriting memory fields).
Do not pass question ids, embeddings, canvas coordinates, or rank — placement is client-side on the graph map.
Structure via manageLinks.`;

/** Short how-to bullet for the agent system prompt. */
export const UPSERT_MEMORY_AGENT_BULLET = `create (omit id; name + content + impression + confidence + questions required) or patch (pass id + only changed fields).
Name the topic (stripped vessel), not the article/problem/snippet title.
Same topic → same id; new topic + existing parent → child; else root.
When sending content, append takeaway + keep Derived from: lines (never drop existing ones).
On create or name/content patch: write ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} ${MEMORY_SEARCH_AGENT_RECALL_STYLE} (full style on questions field) — system only embeds; always full set replace.
Impression/confidence-only is valid — no questions, no re-embed.
Questions-only patch refreshes probes without rewriting memory fields.`;

/** Zod `.describe(...)` for the `name` field on upsertMemory input schema. */
export const upsertMemoryNameFieldDescription = `Short topic label for the graph — the concept, not the vessel
(e.g. 'DP on arrays' not 'LeetCode 198 House Robber'; 'TCP handshake' not 'why did my connection fail').
Required on create; optional on patch (omit to leave stored name).
When you patch name, also pass a full questions set.`;

/** Zod `.describe(...)` for the `content` field on upsertMemory input schema. */
export const upsertMemoryContentFieldDescription = `The pattern, method, or takeaway — not a raw problem statement or session dump.
One concept per node. End with a Derived from: list; when you send content on refine, keep old Derived from: lines and append new sources.
Required on create; optional on patch (omit to leave stored content — e.g. confidence-only).
When you patch content, also pass a full questions set.`;

/** Zod `.describe(...)` for the `impression` field on upsertMemory input schema. */
export const upsertMemoryImpressionFieldDescription = `Spy's evolving read of how the user relates to this memory —
their grasp, interest, confusion, or emotional angle.
Required on create. On patch, omit to leave stored; pass "" to clear.
Impression-only patch: omit questions (no re-embed).`;

/** Zod `.describe(...)` for the `confidence` field on upsertMemory input schema. */
export const upsertMemoryConfidenceFieldDescription = `How solid the user's grasp of this memory is, from 0 (uncertain) to 1 (firm).
Required on create. On patch, omit to leave stored; 0 is a valid write.
Confidence-only patch: omit questions (no re-embed).`;

/** Zod `.describe(...)` for the optional `id` field on upsertMemory input schema. */
export const upsertMemoryIdFieldDescription = `Omit to create a new memory (system generates id; name, content, impression, confidence, and questions required).
Pass an existing Memory id to patch only the fields you send (name/content/impression/confidence/questions).
Not required. Structure (PARENT_OF / RELATES_TO) is via manageLinks, not this tool.
Intermediate hierarchy: create nodes here, then link correctly.`;

/**
 * Zod `.describe(...)` for the `questions` field on upsertMemory input schema.
 * Full write-side briefing for agent-authored Q↔Q probes (tool only embeds).
 * AI SDK sends this as JSON Schema description on the input field.
 */
export const upsertMemoryQuestionsFieldDescription = `Agent-side recall probes for this Memory — power Q↔Q semantic search.
Not a public encyclopedia and not a first-person user notebook.
These are things the agent would ask itself to stay stateful about whether *this user*
already has related knowledge. At search time the agent embeds the same family of probes;
nearest stored questions win (Q↔Q ANN). Write probes that should retrieve *this* Memory
when the agent later wonders about related knowledge.

## Grounding
Base every probe on this tool call's name, content, impression, and confidence only.
Do not invent facts outside those fields.
Specific enough that this Memory is a good answer; not generic fluff any node could match.

## Style (agent-stateful, third-person about the user)
Voice: third-person about the user — the agent pondering what the user knows.
Prefer this stem family:
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

Example: Memory about **Dijkstra's algorithm** should store probes about
Dijkstra *and* shortest paths *and* graph pathfinding / graph algorithms — not only
"Has the user studied Dijkstra's algorithm?"
Later, if the agent asks "Does the user know about shortest-path algorithms?", ANN can match.

Vary wording; do not clone the same stem for every item.

## Count
Prefer ~${MEMORY_QUESTION_COUNT_TARGET} questions (allowed ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX}; schema enforces).

## Anti-patterns (reject these)
- First-person user-meta ("What do I know about…?", "What have I learned regarding…?")
- Duplicates or near-duplicates (same meaning, reworded)
- Vague fluff: "What is this?", "Tell me more", "Any notes?", "Does the user know things?"
- Questions this Memory cannot answer
- Wikipedia-only / pure encyclopedia phrasing with no user-knowledge framing
  (e.g. only "What is Dijkstra?" with no "does the user know / has the user studied" frame)
- Title-only keyword spam with no synonym / related-concept diversity
- Meta questions about the KB system itself
- Vectors, embeddings, coordinates, rank, or layout talk

## Contract
Required on create. Required when patching name or content (full set replace).
Omit on impression/confidence-only (no re-embed).
Questions-only patch is allowed (refresh probes without rewriting memory fields).
Do not pass embeddings, question ids, coordinates, or rank — system embeds and stores.`;
