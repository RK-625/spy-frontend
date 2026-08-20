/**
 * Narrative for manageLinks (weave edge structure path).
 * Tool description + agent bullet + field describes.
 */

/** `tool({ description })` for manageLinks in the product toolset. */
export const manageLinksToolDescription = `Add or remove edges between existing Memory nodes.
Two arrays: remove first, then upsert — one all-or-nothing graph write (all items apply, or none).
On success returns { remove, upsert } batches (each succeeded === total, every item ok: true).
On failure returns { error } only; the graph is unchanged (no partial results).
Identify each edge by source, target, and type — no relationship ids.
PARENT_OF is parent → child (at most one parent). RELATES_TO is associative.
Reparent: old PARENT_OF in remove + new PARENT_OF in upsert in the same call.
Does not invent layout or rank.`;

/** Short how-to bullet for the agent system prompt. */
export const MANAGE_LINKS_AGENT_BULLET = `Tool for adding or removing edges — for attaching, reparenting, or associating Memories,
leading to correct PARENT_OF and RELATES_TO structure.
One call is all-or-nothing (every remove+upsert succeeds, or the graph is unchanged).
Success returns { remove, upsert } all-ok batches; failure returns { error } only.
Reparent = remove old PARENT_OF + upsert new PARENT_OF in the same call.
Does not invent layout or rank.`;

/** Zod `.describe(...)` for the `remove` array on manageLinks input. */
export const manageLinksRemoveFieldDescription = `Edges to delete first (source, target, type).
Missing edge or endpoints is a success no-op for that item.
For reparent, put the old PARENT_OF here; the new one goes in upsert (same call, atomic).`;

/** Zod `.describe(...)` for the `upsert` array on manageLinks input. */
export const manageLinksUpsertFieldDescription = `Edges to create after removes (source, target, type).
PARENT_OF: source = parent, target = child. A second parent is rejected unless this same call removes the old PARENT_OF.
Both endpoints must already exist. Any failure rolls back the entire manageLinks call and returns { error } only.`;
