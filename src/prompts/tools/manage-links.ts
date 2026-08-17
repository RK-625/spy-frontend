/**
 * Narrative for manageLinks (weave edge structure path).
 * Tool description + agent bullet + field describes.
 */

/** `tool({ description })` for manageLinks in the product toolset. */
export const manageLinksToolDescription = `Add or remove edges between existing Memory nodes.
Two arrays: remove first, then upsert. Identify each edge by source, target, and type — no relationship ids.
PARENT_OF is parent → child (at most one parent). RELATES_TO is associative.
Does not invent layout or rank.`;

/** Short how-to bullet for the agent system prompt. */
export const MANAGE_LINKS_AGENT_BULLET = `Tool for adding or removing edges — for attaching, reparenting, or associating Memories,
leading to correct PARENT_OF and RELATES_TO structure.
Does not invent layout or rank.`;

/** Zod `.describe(...)` for the `remove` array on manageLinks input. */
export const manageLinksRemoveFieldDescription = `Edges to delete first (source, target, type).
Missing edge or endpoints is a success no-op for that item.
For reparent, put the old PARENT_OF here; the new one goes in upsert.`;

/** Zod `.describe(...)` for the `upsert` array on manageLinks input. */
export const manageLinksUpsertFieldDescription = `Edges to create after removes (source, target, type).
PARENT_OF: source = parent, target = child. A second parent is rejected.
Both endpoints must already exist.`;
