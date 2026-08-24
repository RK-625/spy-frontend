/**
 * Narrative for upsertMemory (graph write path).
 * Tool description + agent bullet + field describes.
 * Retrieval questions are agent-authored; the tool only embeds them.
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
} from "@/lib/policy-tokens";
import { MEMORY_SEARCH_AGENT_RECALL_STYLE } from "./search-memories";

/** `tool({ description })` for upsertMemory in the product toolset. */
export const upsertMemoryToolDescription = `Create or patch a Memory node.
Omit id to create (name, content, impression, confidence, and questions all required).
Pass id to patch only the fields you send — do not resend unchanged content.
On create or name/content patch, pass ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} retrieval probes (style on the questions field); the system embeds and replaces the stored set.
Impression/confidence-only: omit questions (no re-embed).
Questions-only: refresh probes without rewriting other fields.
Create, name/content, and questions writes are all-or-nothing: embed first when questions are sent, then one graph write — failure returns { error } and leaves the graph unchanged.
Do not pass question ids or embeddings. Does not invent layout or rank.`;

/** Short how-to bullet for the agent system prompt. */
export const UPSERT_MEMORY_AGENT_BULLET = `Tool for creating or refining Memories — for storing what the user has learned into the graph,
leading to durable, searchable knowledge.
Omit id to create; pass id to patch only changed fields. Name/content writes need a full questions set.
Create/name-content/questions writes are all-or-nothing (failure → { error }, graph unchanged).`;

/** Zod `.describe(...)` for the optional `id` field on upsertMemory input schema. */
export const upsertMemoryIdFieldDescription = `Omit to create (system generates id). Pass an existing Memory id to patch — required on patch.
Send only the fields you change.`;

/** Zod `.describe(...)` for the `name` field on upsertMemory input schema. */
export const upsertMemoryNameFieldDescription = `Short topic label — the concept, not the vessel (e.g. 'DP on arrays', not 'LeetCode 198 House Robber').
Required on create; optional on patch (omit to leave the stored name).`;

/** Zod `.describe(...)` for the `content` field on upsertMemory input schema. */
export const upsertMemoryContentFieldDescription = `The description of the pattern, method, or takeaway the user has learned — not a raw dump.
Required on create; optional on patch (omit to leave stored content).
Markdown is allowed (graph source view is markdown).`;

/** Zod `.describe(...)` for the `impression` field on upsertMemory input schema. */
export const upsertMemoryImpressionFieldDescription = `Spy's read of how the user relates to this Memory — grasp, interest, confusion, or stance.
Required on create. On patch, omit to leave stored; pass "" to clear.`;

/** Zod `.describe(...)` for the `confidence` field on upsertMemory input schema. */
export const upsertMemoryConfidenceFieldDescription = `How solid the user's grasp is, from 0 (uncertain) to 1 (firm).
Required on create. On patch, omit to leave stored; 0 is a valid write.`;

/**
 * Zod `.describe(...)` for the `questions` field on upsertMemory input schema.
 * Compressed probe-style home; store-vs-search probe jobs live in GRAPH_CONTEXT.
 * AI SDK sends this as JSON Schema description on the input field.
 */
export const upsertMemoryQuestionsFieldDescription = `${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} ${MEMORY_SEARCH_AGENT_RECALL_STYLE}.
Write probes that should retrieve *this* Memory. Expand synonyms and related concepts; do not invent claims the Memory does not support; do not clone the title or one stem.
Required on create and when patching name or content (full set replace). Omit on impression/confidence-only. Questions-only patch is allowed.`;
