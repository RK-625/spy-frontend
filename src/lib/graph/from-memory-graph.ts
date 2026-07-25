/**
 * from-memory-graph.ts — Memory / Links (Falkor) → GraphData (canvas) bridge.
 *
 * INTENT: contract + implementation notes only. No runtime code in this file
 * until the adapter is intentionally implemented.
 *
 * Pure adapter (when implemented): no Falkor driver, no Pixi, no React.
 * Server routes call Falkor, then map rows into the DTO the graph UI already
 * understands.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE GRAPH UI EXPECTS (consumer API — do not bypass)
 * ---------------------------------------------------------------------------
 *
 * Host: `src/components/graph/graph-canvas.tsx`
 * Draw: `createPixiRenderer().setGraphData(graphData, options?)`
 * Layout (optional): `createLayoutLoop({ graphData, renderOnGraphData })`
 *
 * The canvas does **not** accept raw Memory nodes or Cypher rows. It only
 * accepts our domain DTO:
 *
 *   GraphData = {
 *     nodes: GraphNode[],
 *     edges: GraphEdge[],
 *   }
 *
 * GraphNode (required for draw + signals + rim):
 *   - id: string           — stable app id (Memory.id), unique in the payload
 *   - x, y: number         — world layout position (not in Falkor today;
 *                            must come from layout pass, stored coords later,
 *                            or temporary defaults before FA2)
 *   - rank: number         — hierarchy depth: 0 = root (no PART_OF parent);
 *                            child rank = parent.rank + 1 (authoring rule)
 *   - label?: string       — display name (typically Memory.name)
 *   - childIds / parentIds / relateIds — leave empty arrays; filled by
 *                            recomputeIncidence(graph) after edges are set
 *   - rimOccupations       — leave []; filled by RimLock on the renderer path
 *
 * GraphEdge:
 *   - id: string           — stable edge id (generate if DB has none, e.g.
 *                            `${type}:${source}->${target}`)
 *   - source, target: string — Memory ids
 *   - type: "PART_OF" | "RELATES_TO"
 *       PART_OF convention (must match canvas + rim-lock):
 *         source = child, target = parent
 *       RELATES_TO: associative; direction is stable but non-hierarchical
 *
 * Optional later (not required for first draw):
 *   - SetGraphDataOptions.dirtyEdges / movedNodeIds for partial rebake
 *   - Signal wave uses edge type + endpoints only (no extra DB fields)
 *
 * Public types live in `./graph-data.ts` (and barrel `@/lib/graph`).
 *
 * ---------------------------------------------------------------------------
 * WHAT DATA IS NEEDED (minimum viable payload for /graph)
 * ---------------------------------------------------------------------------
 *
 * 1. A set of memory nodes with at least: id, name (→ label).
 * 2. The set of links among those nodes: source, target, type.
 * 3. Layout positions x,y for every node (or a layout step after map).
 * 4. Rank for every node (or compute from PART_OF DAG after map).
 *
 * Nice-to-have (not blocking first wire):
 *   - confidence / content snippet for future labels or tooltips
 *   - session / user scope (which subgraph to load)
 *   - viewport bounds for large-KB residency (Tier D — later)
 *
 * Not needed for the canvas:
 *   - embeddings (search path only)
 *   - full content/impression blobs (unless showing detail chrome later)
 *   - Falkor internal numeric node ids (use Memory.id string only)
 *
 * ---------------------------------------------------------------------------
 * WHAT THE DATABASE SHOULD PROVIDE (FalkorDB — not SQLite)
 * ---------------------------------------------------------------------------
 *
 * Existing stack: `src/lib/falkor.ts`, graph name `spy_brain`, env DATABASE_URL.
 * Schema types: `src/types/graph-schema.ts` (Memory, Links).
 *
 * Today Falkor can provide (via Cypher / helpers):
 *
 *   Memory nodes:
 *     id, name, content, impression, confidence,
 *     searchEmbedding, contentEmbedding
 *
 *   Links (relationship type on the edge):
 *     source Memory.id → target Memory.id
 *     type ∈ { PART_OF, RELATES_TO }
 *     createLink already MERGEs (source)-[r:TYPE]->(target)
 *
 * Today Falkor does **not** provide (adapter or layout must supply):
 *   - x, y layout coordinates
 *   - rank
 *   - precomputed incidence / rimOccupations
 *   - canvas edge string ids (unless you invent them in Cypher RETURN)
 *
 * Server-side fetch (future `src/lib/falkor-graph.ts` or extensions of falkor.ts)
 * should return something equivalent to:
 *
 *   {
 *     memories: Array<{ id, name, ...optional fields }>,
 *     links: Array<{ source, target, type: "PART_OF" | "RELATES_TO" }>,
 *   }
 *
 * Then a pure mapper (this file, when implemented) maps → GraphData; then
 * layout assigns x,y (or merge stored positions when they exist on Memory later).
 *
 * Runtime: Node.js only for Falkor native driver (API route, not Edge, not
 * browser). Never import falkordb into a pure adapter module.
 *
 * ---------------------------------------------------------------------------
 * PIPELINE (full implementation)
 * ---------------------------------------------------------------------------
 *
 *   Browser GraphCanvas
 *     → GET /api/graph  (or prep-session style route, Node runtime)
 *         → falkor-graph / falkor: load memories + links (scoped)
 *         → from-memory-graph: memories+links → GraphData (rank, labels, edge ids)
 *         → layout: positions (static tree, one-shot FA2, or stored x,y)
 *         → JSON GraphData
 *     → renderer.setGraphData(data) + layoutLoop if needed
 *
 *   Fallback while DB empty / offline:
 *     createMockGraphData() from ./fixtures/mock-graph
 *
 * ---------------------------------------------------------------------------
 * AFTER FULL IMPLEMENTATION — DELETE / CLEAN UP / BECOMES REDUNDANT
 * ---------------------------------------------------------------------------
 *
 * When live Falkor → GraphData is the default path for /graph:
 *
 * DELETE or demote (no longer default product path):
 *   - GraphCanvas hard-coded `createMockGraphData()` as the only source
 *     (keep as fallback or `?mock=1` only)
 *   - Treating stress fixture as a “product” graph (`?stress=1` stays dev-only)
 *
 * KEEP (still useful):
 *   - `fixtures/mock-graph.ts` — offline, tests, verify-mock-layout, CI
 *   - `createLargeStressGraphData` — perf stress only, not user-facing default
 *   - All bake / pulse / pixi code — unchanged consumers of GraphData
 *
 * BECOMES REDUNDANT (remove only if nothing imports them):
 *   - Duplicate “fake graph” builders if any are added ad-hoc in page.tsx
 *   - Temporary hardcoded node lists in API routes once adapter is complete
 *   - Client-side mocks of Memory shapes that only exist to feed the canvas
 *
 * DO NOT DELETE:
 *   - graph-data.ts types and recomputeIncidence
 *   - falkor.ts low-level getDb / upsertMemory / createLink / vectorSearch
 *   - fixtures used by scripts/verify-*.mjs
 *
 * OPTIONAL LATER CLEANUP (not required for first wire):
 *   - Split pixi-renderer.ts when this adapter is stable and data-driven
 *   - Store x,y,rank on Memory in Falkor to skip layout on every load
 *
 * ---------------------------------------------------------------------------
 * IMPLEMENTATION STATUS
 * ---------------------------------------------------------------------------
 *
 * Comments / contract only — no exports, no mapper runtime yet.
 * Implement memoryGraphToGraphData (and related types) in this file when
 * the API route and Falkor subgraph query land.
 */
