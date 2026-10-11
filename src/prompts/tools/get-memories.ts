/**
 * Narrative for getMemories (PARENT_OF cone + center RELATES_TO inspect path).
 * Tool description + chat/graph bullets + field describes.
 */

import { MEMORY_GET_MAX_REQUESTS } from "@/lib/graph/policy";

/** `tool({ description })` for getMemories in the product toolset. */
export const getMemoriesToolDescription = `Inspect one or more Memories and their topology in one call.
Pass memories: an array of 1–${MEMORY_GET_MAX_REQUESTS} objects, each with id, optional hops, and required linkTypes.
For each object, pass linkTypes: ["PARENT_OF"], ["RELATES_TO"], or both. hops applies only to that object's PARENT_OF traversal and defaults to 0.
Returns { results } in request order, one entry per request, including repeated ids with different settings.
Success: { id, ok: true, memory, ancestors, descendants, relatesTo }. memory includes name, content, impression, and confidence.
Failure: { id, ok: false, error }. One failed lookup does not discard successful results; inspect each entry's ok flag.
Does not write nodes or invent layout.`;

/** Short how-to bullet for the chat-agent system prompt. */
export const GET_MEMORIES_CHAT_BULLET = `Inspect one or more Memories and their parent/children/associations to ground teaching.
Batch known ids in memories, each with independent hops and linkTypes. Read each results entry's ok flag before using it.
Does not write nodes or invent ids.`;

/** Short how-to bullet for the graph-agent system prompt. */
export const GET_MEMORIES_GRAPH_BULLET = `Inspect topology before refine, attach, or reparent.
Batch known ids in memories, each with independent hops and linkTypes. Read each results entry's ok flag before using it.
Does not write nodes or invent ids.`;

/** Zod description for the batch of independently configured lookups. */
export const getMemoriesMemoriesFieldDescription = `1–${MEMORY_GET_MAX_REQUESTS} Memory lookups, each with its own id, optional hops (default 0), and required linkTypes.
Use a one-item array for a single Memory. Results preserve request order, including repeated ids; each result succeeds or fails independently.`;

/** Zod `.describe(...)` for the `id` field on getMemories input schema. */
export const getMemoriesIdFieldDescription = `The Memory id to inspect (cone center).
Must already exist — unknown id returns an error; do not invent ids.`;

/** Zod `.describe(...)` for the optional `hops` field on getMemories input schema. */
export const getMemoriesHopsFieldDescription = `PARENT_OF generations to load from the center. Optional; omit for 0 (this Memory only).
1 = parent (if any) and direct children, plus the center. Higher walks more generations.
Applies only when PARENT_OF is in linkTypes; ignored when linkTypes is only RELATES_TO. Missing generations are omitted.`;

/** Zod `.describe(...)` for the required `linkTypes` field on getMemories input schema. */
export const getMemoriesLinkTypesFieldDescription = `Which edge kinds to load. Required; at least one of PARENT_OF and RELATES_TO.
["PARENT_OF"] — hops as generations; relatesTo empty.
["RELATES_TO"] — hops ignored; only edges touching the center (ancestors/descendants empty).
Both — PARENT_OF cone plus center RELATES_TO.
RELATES_TO is never a multi-hop walk.`;
