/**
 * Narrative for linkMemories (weave edge path).
 * Tool description + agent bullet.
 */

/** `tool({ description })` for linkMemories in the product toolset. */
export const linkMemoriesToolDescription = `Create a directed edge between two existing Memory nodes.
Call only after both nodes exist (upsert first if needed).
PARENT_OF is hierarchical (source = parent → target = child); a child may have at most one PARENT_OF parent.
RELATES_TO is associative.
Geometry / rank are never LLM-authored — the graph client derives rank and places nodes from topology.`;

/** Short how-to bullet for the agent system prompt. */
export const LINK_MEMORIES_AGENT_BULLET = `connect two existing Memory ids only.
PARENT_OF: source = parent, target = child (one parent max).
RELATES_TO: associative.
Upsert both ends first, then link.
Do not invent ids.`;

/** Zod `.describe(...)` for the `source` field on linkMemories input schema. */
export const linkMemoriesSourceFieldDescription = `Memory id of the source node. Both nodes must already exist (upsert first).
For PARENT_OF this MUST be the parent (broader containing concept).
Do not pass canvas coordinates or rank — tools never author geometry.`;

/** Zod `.describe(...)` for the `target` field on linkMemories input schema. */
export const linkMemoriesTargetFieldDescription = `Memory id of the target node. Both nodes must already exist.
For PARENT_OF this MUST be the child (more specific node).`;

/** Zod `.describe(...)` for the `type` field on linkMemories input schema. */
export const linkMemoriesTypeFieldDescription = `PARENT_OF: hierarchical parent→child (source=parent, target=child).
RELATES_TO: associative link with no hierarchy.
Your job is correct links only (and removing a wrong old PARENT_OF when that is supported).
The graph client derives rank from PARENT_OF and places nodes from topology.`;
