/**
 * Narrative for getMemories (PARENT_OF cone + center RELATES_TO inspect path).
 * Tool description, schema field describe, agent bullet.
 */

/** `tool({ description })` for getMemories in the product toolset. */
export const getMemoriesToolDescription = `Inspect a Memory by id and its topology.
After search, pass a candidate id.
Always pass linkTypes with at least one value: ["PARENT_OF"], ["RELATES_TO"], or both.
hops is PARENT_OF generations when PARENT_OF is in linkTypes: 0 is the center only; 1 is parent (if any) plus children; higher walks more generations. Missing generations are omitted. hops is ignored when linkTypes is only RELATES_TO.
RELATES_TO returns only edges touching the center (incoming and outgoing) — not a blast and not edges on every child in the cone. hops never walks RELATES_TO.
Use before refine, link, or adopt. Before manageLinks, include RELATES_TO in linkTypes so remove[] can copy the returned triples.
Does not invent layout or write nodes.`;

/** Short how-to bullet for the agent system prompt. */
export const GET_MEMORIES_AGENT_BULLET = `After search, inspect a candidate id.
Always pass linkTypes: ["PARENT_OF"], ["RELATES_TO"], or both.
hops = PARENT_OF generations when PARENT_OF is included; RELATES_TO is center-incident triples only (copy into manageLinks remove/upsert).
Then refine, link, or adopt.`;

/** Zod `.describe(...)` for the `id` field on getMemories input schema. */
export const getMemoriesIdFieldDescription = `Existing Memory id to inspect as the cone center.
Unknown id returns an error — do not invent ids.`;

/** Zod `.describe(...)` for the optional `hops` field on getMemories input schema. */
export const getMemoriesHopsFieldDescription = `PARENT_OF generations from the center — only when PARENT_OF is in linkTypes.
Not a blast radius and not RELATES_TO. 0 (default) is the center only for PARENT_OF. 1 is the parent (if any) and direct children. Higher includes more generations.
Missing generations are omitted. Ignored when linkTypes is only RELATES_TO. Not layout.`;

/** Zod `.describe(...)` for the required `linkTypes` field on getMemories input schema. */
export const getMemoriesLinkTypesFieldDescription = `Which edge kinds to load around the center. Required; at least one value.
["PARENT_OF"] — hops as generations; relatesTo empty.
["RELATES_TO"] — ignores hops; center-incident RELATES_TO only (ancestors/descendants empty).
Both — PARENT_OF cone plus center RELATES_TO.
RELATES_TO is never a multi-hop walk.`;
