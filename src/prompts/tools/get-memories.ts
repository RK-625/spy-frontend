/**
 * Narrative for getMemories (PARENT_OF cone inspect path).
 * Tool description, schema field describe, agent bullet.
 */

/** `tool({ description })` for getMemories in the product toolset. */
export const getMemoriesToolDescription = `Inspect a Memory by id and its PARENT_OF cone.
After search, pass a candidate id. hops is PARENT_OF generations, not a blast radius and not RELATES_TO:
0 is the center only; 1 is parent (if any) plus children; higher walks more generations.
Missing generations are omitted.
Use before refine, link, or adopt. Does not invent layout or write nodes.`;

/** Short how-to bullet for the agent system prompt. */
export const GET_MEMORIES_AGENT_BULLET = `After search, inspect a candidate id.
hops 0 is self; hops 1 is parent + children + itself; higher walks more generations.
Then refine, link, or adopt.`;

/** Zod `.describe(...)` for the `id` field on getMemories input schema. */
export const getMemoriesIdFieldDescription = `Existing Memory id to inspect as the cone center.
Unknown id returns an error — do not invent ids.`;

/** Zod `.describe(...)` for the optional `hops` field on getMemories input schema. */
export const getMemoriesHopsFieldDescription = `PARENT_OF generations from the center — not a blast radius and not RELATES_TO.
0 (default) is the center only. 1 is the parent (if any) and direct children. Higher includes more generations.
Missing generations are omitted. Not layout.`;
