/**
 * Narrative for getMemories (PARENT_OF cone + center RELATES_TO inspect path).
 * Tool description + agent bullet + field describes.
 */

/** `tool({ description })` for getMemories in the product toolset. */
export const getMemoriesToolDescription = `Inspect a Memory by id and its topology.
Always pass linkTypes: ["PARENT_OF"], ["RELATES_TO"], or both. hops applies only to PARENT_OF.
Does not write nodes or invent layout.`;

/** Short how-to bullet for the agent system prompt. */
export const GET_MEMORIES_AGENT_BULLET = `Tool for inspecting a Memory and its topology — for understanding parent, children, and associations
before refine, attach, or reparent,
leading to aligned structure writes.
Does not write nodes or invent ids.`;

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
