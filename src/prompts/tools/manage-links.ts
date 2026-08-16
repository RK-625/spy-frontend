/**
 * Narrative for manageLinks (weave edge structure path).
 * Tool description + agent bullet + field describes for remove/upsert arrays.
 */

/** `tool({ description })` for manageLinks in the product toolset. */
export const manageLinksToolDescription = `Batch structure edges between existing Memory nodes.
Two arrays: remove then upsert. All removes run first; then all upserts (MERGE after).
PARENT_OF is hierarchical (source = parent → target = child); a child may have at most one PARENT_OF parent.
Reparent: put the old PARENT_OF in remove and the new PARENT_OF in upsert. If remove succeeds and upsert fails, the child may be left as a root (accepted).
Inspect topology with getMemories first (copy RELATES_TO triples from getMemories into remove/upsert when editing associations); do not create PARENT_OF cycles (a node must not become a descendant of itself).
RELATES_TO is associative. No relationship ids — identify edges by source, target, type.
Missing remove endpoints or edges are success no-ops; same upsert triple already present is success no-op (MERGE).
Geometry / rank are never LLM-authored — the graph client derives rank and places nodes from topology.`;

/** Short how-to bullet for the agent system prompt. */
export const MANAGE_LINKS_AGENT_BULLET = `batch remove then upsert directed edges (source/target/type; no ids).
PARENT_OF: source = parent, target = child (one parent max).
Reparent = remove old PARENT_OF then upsert new; do not upsert a second parent.
Inspect with getMemories first (copy RELATES_TO triples from getMemories when needed); do not form PARENT_OF cycles.
RELATES_TO: extra homes / association. Do not invent ids.`;

/** Zod `.describe(...)` for the `remove` array on manageLinks input. */
export const manageLinksRemoveFieldDescription = `Edges to delete first (source, target, type).
Missing edge or endpoints → success no-op for that item.
For reparent, include the old PARENT_OF here before the new one in upsert.`;

/** Zod `.describe(...)` for the `upsert` array on manageLinks input. */
export const manageLinksUpsertFieldDescription = `Edges to create or keep after removes (MERGE; already-present triple is success no-op).
PARENT_OF: source = parent, target = child; sticky parent blocks a second parent (not silent steal).
Both endpoints must already exist (upsertMemory first).`;
